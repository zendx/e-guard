import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SCAN_TIMEOUT_MS = 120_000;
let activeScan: Promise<{
  success: boolean;
  output: string;
  errorOutput: string;
}> | null = null;

const CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
};
const HISTORY_FILE_PATH = path.join(process.cwd(), "data", "trends_history.json");
const MAX_HISTORY_SNAPSHOTS = 288;

type CountryPayload = {
  topics?: string[];
  hashtags?: string[];
  regular_topics?: string[];
  fast_rising?: string[];
  [key: string]: unknown;
};

type TrendsPayload = {
  generated_at_utc?: string;
  countries?: Record<string, CountryPayload>;
  [key: string]: unknown;
};

type HistorySnapshot = {
  generated_at_utc: string;
  countries: Record<string, { topics: string[] }>;
};

type HistoryFile = {
  snapshots: HistorySnapshot[];
};

function normalizeTopicLabel(topic: string): string {
  return topic.replace(/\s+/g, " ").trim();
}

function getCountryTopics(countryData: CountryPayload | undefined): string[] {
  if (!countryData) {
    return [];
  }

  const fromTopics = Array.isArray(countryData.topics) ? countryData.topics : [];
  const fromHashtags = Array.isArray(countryData.hashtags) ? countryData.hashtags : [];
  const fromRegular = Array.isArray(countryData.regular_topics)
    ? countryData.regular_topics
    : [];
  const merged = fromTopics.length > 0 ? fromTopics : [...fromHashtags, ...fromRegular];
  return Array.from(
    new Set(
      merged
        .map((topic) => (typeof topic === "string" ? normalizeTopicLabel(topic) : ""))
        .filter((topic) => topic.length > 0),
    ),
  ).slice(0, 50);
}

function toHistorySnapshot(payload: TrendsPayload): HistorySnapshot {
  const countries: Record<string, { topics: string[] }> = {};
  for (const [country, countryData] of Object.entries(payload.countries ?? {})) {
    countries[country] = { topics: getCountryTopics(countryData) };
  }

  return {
    generated_at_utc: payload.generated_at_utc ?? new Date().toISOString(),
    countries,
  };
}

async function readHistory(): Promise<HistorySnapshot[]> {
  try {
    const raw = await readFile(HISTORY_FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as HistoryFile;
    if (!parsed || !Array.isArray(parsed.snapshots)) {
      return [];
    }
    return parsed.snapshots;
  } catch {
    return [];
  }
}

async function persistHistory(snapshots: HistorySnapshot[]): Promise<void> {
  const payload: HistoryFile = {
    snapshots: snapshots.slice(-MAX_HISTORY_SNAPSHOTS),
  };

  await mkdir(path.dirname(HISTORY_FILE_PATH), { recursive: true });
  await writeFile(HISTORY_FILE_PATH, JSON.stringify(payload, null, 2), "utf-8");
}

async function upsertSnapshot(payload: TrendsPayload): Promise<HistorySnapshot[]> {
  const snapshots = await readHistory();
  const latest = snapshots.at(-1);
  const next = toHistorySnapshot(payload);
  const sameSnapshot = latest?.generated_at_utc === next.generated_at_utc;
  const merged = sameSnapshot ? snapshots : [...snapshots, next].slice(-MAX_HISTORY_SNAPSHOTS);

  try {
    if (!sameSnapshot) {
      await persistHistory(merged);
    }
  } catch {
    // Ignore history write failures in read-only runtimes.
  }

  return merged;
}

function findPreviousTopics(
  snapshots: HistorySnapshot[],
  country: string,
): string[] {
  if (snapshots.length <= 1) {
    return [];
  }

  for (let i = snapshots.length - 2; i >= 0; i -= 1) {
    const topics = snapshots[i]?.countries?.[country]?.topics ?? [];
    if (topics.length > 0) {
      return topics;
    }
  }

  return [];
}

function computeFastRisingTopics(
  currentTopics: string[],
  previousTopics: string[],
): string[] {
  if (currentTopics.length === 0) {
    return [];
  }

  const prevRanks = new Map<string, number>();
  previousTopics.forEach((topic, index) => {
    prevRanks.set(topic, index + 1);
  });

  const scored = currentTopics.map((topic, index) => {
    const currentRank = index + 1;
    const previousRank = prevRanks.get(topic) ?? null;
    const isNew = previousRank === null;
    const rankGain = previousRank ? Math.max(0, previousRank - currentRank) : 0;
    const newBoost = isNew ? 8 : 0;
    const positionBoost = Math.max(0, 12 - currentRank);
    const score = newBoost + rankGain * 2 + positionBoost;

    return { topic, score, currentRank };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.currentRank - b.currentRank;
  });

  return scored.map((item) => item.topic).slice(0, 20);
}

function decoratePayloadWithFastRising(
  payload: TrendsPayload,
  snapshots: HistorySnapshot[],
): TrendsPayload {
  const countries = payload.countries ?? {};
  const nextCountries: Record<string, CountryPayload> = {};

  for (const [country, countryData] of Object.entries(countries)) {
    const currentTopics = getCountryTopics(countryData);
    const previousTopics = findPreviousTopics(snapshots, country);
    const fastRising =
      previousTopics.length > 0
        ? computeFastRisingTopics(currentTopics, previousTopics)
        : currentTopics.slice(0, 20);

    nextCountries[country] = {
      ...countryData,
      fast_rising: fastRising,
    };
  }

  return {
    ...payload,
    countries: nextCountries,
  };
}

function resolveGithubRawUrl(): string | null {
  if (process.env.TRENDS_JSON_URL) {
    return process.env.TRENDS_JSON_URL;
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";

  if (!owner || !repo) {
    return null;
  }

  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/data/trends_by_country.json`;
}

async function readLocalPayload(): Promise<object> {
  const filePath = path.join(process.cwd(), "data", "trends_by_country.json");
  const fileContents = await readFile(filePath, "utf-8");
  return JSON.parse(fileContents) as object;
}

async function readGithubPayload(rawUrl: string): Promise<object> {
  const separator = rawUrl.includes("?") ? "&" : "?";
  const urlWithBust = `${rawUrl}${separator}ts=${Date.now()}`;

  const response = await fetch(urlWithBust, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${rawUrl}: ${response.status}`);
  }
  return (await response.json()) as object;
}

export async function GET() {
  try {
    const rawUrl = resolveGithubRawUrl();
    const payload = (rawUrl
      ? await readGithubPayload(rawUrl).catch(async () => readLocalPayload())
      : await readLocalPayload()) as TrendsPayload;
    const snapshots = await upsertSnapshot(payload);
    const responsePayload = decoratePayloadWithFastRising(payload, snapshots);

    return NextResponse.json(responsePayload, {
      headers: CACHE_HEADERS,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to read trends data file.";

    return NextResponse.json(
      { error: message, countries: {} },
      {
        status: 500,
        headers: CACHE_HEADERS,
      },
    );
  }
}

function runScan(): Promise<{
  success: boolean;
  output: string;
  errorOutput: string;
}> {
  return new Promise((resolve) => {
    const pythonBin = process.env.PYTHON_BIN || "python";
    const scriptPath = path.join(
      process.cwd(),
      "scripts",
      "scrape_trending_topics.py",
    );
    const outputPath = path.join("data", "trends_by_country.json");

    const child = spawn(
      pythonBin,
      [scriptPath, "--output", outputPath],
      { cwd: process.cwd(), windowsHide: true },
    );

    let output = "";
    let errorOutput = "";
    let timedOut = false;
    let settled = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, SCAN_TIMEOUT_MS);

    const finish = (payload: {
      success: boolean;
      output: string;
      errorOutput: string;
    }) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(payload);
    };

    child.stdout.on("data", (chunk: Buffer | string) => {
      output += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      errorOutput += chunk.toString();
    });

    child.on("error", (error) => {
      finish({
        success: false,
        output,
        errorOutput: `${errorOutput}\n${error.message}`,
      });
    });

    child.on("close", (code) => {
      if (timedOut) {
        finish({
          success: false,
          output,
          errorOutput: `${errorOutput}\nScan timed out after ${SCAN_TIMEOUT_MS / 1000}s.`,
        });
        return;
      }

      finish({
        success: code === 0,
        output,
        errorOutput,
      });
    });
  });
}

export async function POST() {
  try {
    const auth = await requireAdminUser();
    if (!auth.ok) {
      return auth.response;
    }

    if (process.env.VERCEL === "1") {
      return NextResponse.json(
        {
          success: false,
          message: "Manual scan is unavailable in this environment.",
        },
        { status: 501, headers: CACHE_HEADERS },
      );
    }

    if (!activeScan) {
      activeScan = runScan().finally(() => {
        activeScan = null;
      });
    }

    const result = await activeScan;
    const status = result.success ? 200 : 500;

    return NextResponse.json(
      {
        success: result.success,
        message: result.success
          ? "Scan completed successfully."
          : "Scan failed. Check error output.",
        stdout: result.output.trim(),
        stderr: result.errorOutput.trim(),
      },
      {
        status,
        headers: CACHE_HEADERS,
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected scan failure.";
    return NextResponse.json(
      { success: false, message },
      {
        status: 500,
        headers: CACHE_HEADERS,
      },
    );
  }
}

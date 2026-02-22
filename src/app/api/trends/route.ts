import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { NextResponse } from "next/server";

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
    const payload = rawUrl
      ? await readGithubPayload(rawUrl).catch(async () => readLocalPayload())
      : await readLocalPayload();

    return NextResponse.json(payload, {
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
    if (process.env.VERCEL === "1") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Manual scan is disabled on Vercel. Use GitHub Actions workflow to refresh trends.",
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

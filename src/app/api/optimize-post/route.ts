import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { requireSessionUser } from "@/lib/auth-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
};

type TrendsApiCountry = {
  topics?: string[];
  hashtags?: string[];
  regular_topics?: string[];
};

type TrendsApiResponse = {
  countries?: Record<string, TrendsApiCountry>;
};

type OptimizeRequestBody = {
  post?: string;
  country?: string;
  mode?: "all" | "hashtags" | "regular";
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

async function readLocalPayload(): Promise<TrendsApiResponse> {
  const filePath = path.join(process.cwd(), "data", "trends_by_country.json");
  const fileContents = await readFile(filePath, "utf-8");
  return JSON.parse(fileContents) as TrendsApiResponse;
}

async function readGithubPayload(rawUrl: string): Promise<TrendsApiResponse> {
  const separator = rawUrl.includes("?") ? "&" : "?";
  const urlWithBust = `${rawUrl}${separator}ts=${Date.now()}`;

  const response = await fetch(urlWithBust, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${rawUrl}: ${response.status}`);
  }

  return (await response.json()) as TrendsApiResponse;
}

async function loadTrendsPayload(): Promise<TrendsApiResponse> {
  const rawUrl = resolveGithubRawUrl();
  if (!rawUrl) {
    return readLocalPayload();
  }

  return readGithubPayload(rawUrl).catch(async () => readLocalPayload());
}

function buildTrendsContext(
  trendsPayload: TrendsApiResponse,
  country: string,
  mode: "all" | "hashtags" | "regular",
): string {
  const countryData = trendsPayload.countries?.[country];
  if (!countryData) {
    return "No live trends available for this country.";
  }

  const allTopics = Array.isArray(countryData.topics) ? countryData.topics : [];
  const hashtags = Array.isArray(countryData.hashtags)
    ? countryData.hashtags
    : allTopics.filter((topic) => topic.startsWith("#"));
  const regularTopics = Array.isArray(countryData.regular_topics)
    ? countryData.regular_topics
    : allTopics.filter((topic) => !topic.startsWith("#"));

  const selectedTopics =
    mode === "hashtags" ? hashtags : mode === "regular" ? regularTopics : allTopics;

  const limited = selectedTopics.slice(0, 15);
  if (limited.length === 0) {
    return "No live trends available for this country.";
  }

  return limited.join(" | ");
}

export async function POST(request: Request) {
  try {
    const auth = await requireSessionUser();
    if (!auth.ok) {
      return auth.response;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Missing ANTHROPIC_API_KEY. Add it to your environment to enable post optimization.",
        },
        { status: 500, headers: CACHE_HEADERS },
      );
    }

    const body = (await request.json()) as OptimizeRequestBody;
    const post = typeof body.post === "string" ? body.post.trim() : "";
    const country = typeof body.country === "string" ? body.country.trim() : "USA";
    const mode = body.mode === "hashtags" || body.mode === "regular" ? body.mode : "all";
    if (auth.user.plan !== "pro") {
      return NextResponse.json(
        {
          error: "AI Post Optimizer is a Pro feature. Upgrade to unlock Boost Me.",
        },
        { status: 402, headers: CACHE_HEADERS },
      );
    }

    if (!post) {
      return NextResponse.json(
        { error: "Post text is required." },
        { status: 400, headers: CACHE_HEADERS },
      );
    }

    const trendsPayload = await loadTrendsPayload();
    const trendsContext = buildTrendsContext(trendsPayload, country, mode);

    const systemPrompt = [
      "You are an X (Twitter) Growth Expert.",
      "Goal: optimize a draft post to improve projected reach by about 40%.",
      `Current Trends Context: ${trendsContext}`,
      "Rules:",
      "1) Hook check: if first 10 words are weak, rewrite with a stronger hook.",
      "2) Contextual insertion: naturally weave relevant trend keywords into sentences.",
      "3) Formatting: use white space / line breaks for readability.",
      "4) Keep under 280 characters.",
      "Return only the optimized post text. No intro, no labels, no markdown.",
    ].join("\n");

    const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";

    const result = streamText({
      model: anthropic(model),
      system: systemPrompt,
      prompt: `Original Post:\n${post}`,
      temperature: 0.7,
      maxTokens: 300,
    });

    return result.toTextStreamResponse({ headers: CACHE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected optimizer error.";

    return NextResponse.json(
      { error: message },
      { status: 500, headers: CACHE_HEADERS },
    );
  }
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, RefreshCw, TrendingUp, WandSparkles } from "lucide-react";

type TrendsApiCountry = {
  topics?: string[];
  hashtags?: string[];
  regular_topics?: string[];
  timeline_timestamp?: string;
};

type TrendsApiResponse = {
  generated_at_utc?: string;
  source?: string;
  countries?: Record<string, TrendsApiCountry>;
  error?: string;
};

type ScanApiResponse = {
  success?: boolean;
  message?: string;
  stdout?: string;
  stderr?: string;
};

type TopicMode = "all" | "hashtags" | "regular";
type UserPlan = "free" | "pro";

const fallbackTrendsByCountry: Record<string, string[]> = {
  USA: [
    "#OpenAI",
    "Bitcoin",
    "SuperBowl",
    "AppleVisionPro",
    "Web3",
    "FrontendDev",
    "SaaS",
    "DeepSeek",
    "ProductHunt",
    "GrowthHacking",
    "TechNews",
  ],
  UK: [
    "#London",
    "PremierLeague",
    "Fintech",
    "UKPolitics",
    "AIStartups",
    "EdTech",
    "CleanEnergy",
    "CyberSecurity",
    "CreatorEconomy",
    "TechJobs",
    "DigitalHealth",
  ],
};

const defaultPlan: UserPlan =
  process.env.NEXT_PUBLIC_DEFAULT_PLAN === "pro" ? "pro" : "free";

export default function TwitterGrowthApp() {
  const [allTrendsByCountry, setAllTrendsByCountry] = useState<
    Record<string, string[]>
  >(fallbackTrendsByCountry);
  const [hashtagsByCountry, setHashtagsByCountry] = useState<
    Record<string, string[]>
  >({});
  const [regularTrendsByCountry, setRegularTrendsByCountry] = useState<
    Record<string, string[]>
  >({});
  const [countryTimestamps, setCountryTimestamps] = useState<
    Record<string, string>
  >({});
  const [selectedCountry, setSelectedCountry] = useState("USA");
  const [topicMode, setTopicMode] = useState<TopicMode>("all");
  const [source, setSource] = useState<string | null>(null);
  const [generatedAtUtc, setGeneratedAtUtc] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [copied, setCopied] = useState(false);

  const [userPlan, setUserPlan] = useState<UserPlan>(defaultPlan);
  const [userPost, setUserPost] = useState("");
  const [optimizedPost, setOptimizedPost] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [copiedOptimized, setCopiedOptimized] = useState(false);

  const countries = useMemo(
    () => Object.keys(allTrendsByCountry),
    [allTrendsByCountry],
  );

  const visibleTrends = useMemo(() => {
    if (topicMode === "hashtags") {
      return hashtagsByCountry[selectedCountry] ?? [];
    }
    if (topicMode === "regular") {
      return regularTrendsByCountry[selectedCountry] ?? [];
    }
    return allTrendsByCountry[selectedCountry] ?? [];
  }, [
    topicMode,
    selectedCountry,
    allTrendsByCountry,
    hashtagsByCountry,
    regularTrendsByCountry,
  ]);

  const trendString = useMemo(() => visibleTrends.join(" "), [visibleTrends]);
  const currentTimestamp = countryTimestamps[selectedCountry] ?? null;

  const loadTrends = useCallback(
    async (mounted = true) => {
      try {
        const response = await fetch("/api/trends", { cache: "no-store" });
        const data: TrendsApiResponse = await response.json();

        if (!mounted) {
          return;
        }

        if (!response.ok) {
          setLoadError(data.error ?? "Could not load trends.");
          return;
        }

        const nextAllTrendsByCountry: Record<string, string[]> = {};
        const nextHashtagsByCountry: Record<string, string[]> = {};
        const nextRegularByCountry: Record<string, string[]> = {};
        const nextTimestamps: Record<string, string> = {};
        const countriesPayload = data.countries ?? {};

        for (const [country, info] of Object.entries(countriesPayload)) {
          const allTopics = Array.isArray(info?.topics) ? info.topics : [];
          const hashtags = Array.isArray(info?.hashtags)
            ? info.hashtags
            : allTopics.filter((topic) => topic.startsWith("#"));
          const regularTopics = Array.isArray(info?.regular_topics)
            ? info.regular_topics
            : allTopics.filter((topic) => !topic.startsWith("#"));

          if (
            allTopics.length === 0 &&
            hashtags.length === 0 &&
            regularTopics.length === 0
          ) {
            continue;
          }

          nextAllTrendsByCountry[country] =
            allTopics.length > 0
              ? allTopics
              : [...hashtags, ...regularTopics].slice(0, 11);
          nextHashtagsByCountry[country] = hashtags;
          nextRegularByCountry[country] = regularTopics;

          if (info.timeline_timestamp) {
            nextTimestamps[country] = info.timeline_timestamp;
          }
        }

        if (Object.keys(nextAllTrendsByCountry).length > 0) {
          setAllTrendsByCountry(nextAllTrendsByCountry);
          setHashtagsByCountry(nextHashtagsByCountry);
          setRegularTrendsByCountry(nextRegularByCountry);
          setCountryTimestamps(nextTimestamps);
          setLoadError(null);

          setSelectedCountry((currentCountry) =>
            nextAllTrendsByCountry[currentCountry]
              ? currentCountry
              : Object.keys(nextAllTrendsByCountry)[0],
          );
        } else {
          setLoadError("No topics found in scraped data yet.");
        }

        setGeneratedAtUtc(data.generated_at_utc ?? null);
        setSource(data.source ?? null);
      } catch {
        if (mounted) {
          setLoadError("Could not load fresh trends. Showing fallback data.");
          setHashtagsByCountry((current) =>
            Object.keys(current).length > 0
              ? current
              : Object.fromEntries(
                  Object.entries(fallbackTrendsByCountry).map(([country, topics]) => [
                    country,
                    topics.filter((topic) => topic.startsWith("#")),
                  ]),
                ),
          );
          setRegularTrendsByCountry((current) =>
            Object.keys(current).length > 0
              ? current
              : Object.fromEntries(
                  Object.entries(fallbackTrendsByCountry).map(([country, topics]) => [
                    country,
                    topics.filter((topic) => !topic.startsWith("#")),
                  ]),
                ),
          );
        }
      }
    },
    [],
  );

  useEffect(() => {
    let mounted = true;

    loadTrends(mounted);
    const interval = window.setInterval(() => {
      void loadTrends(mounted);
    }, 60000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [loadTrends]);

  const scanFreshTopics = async () => {
    setIsScanning(true);
    setScanStatus(null);

    try {
      const response = await fetch("/api/trends", {
        method: "POST",
        cache: "no-store",
      });
      const data: ScanApiResponse = await response.json();

      if (!response.ok || !data.success) {
        setScanStatus(data.message ?? data.stderr ?? "Scan failed.");
        setIsScanning(false);
        return;
      }

      setScanStatus("Scan completed. Loading fresh topics...");
      await loadTrends(true);
      setScanStatus("Fresh topics loaded.");
    } catch {
      setScanStatus("Scan request failed.");
    } finally {
      setIsScanning(false);
    }
  };

  const optimizePost = async () => {
    if (!userPost.trim()) {
      setOptimizeError("Write a post first.");
      return;
    }

    setIsOptimizing(true);
    setOptimizeError(null);
    setOptimizedPost("");
    setCopiedOptimized(false);

    try {
      const response = await fetch("/api/optimize-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post: userPost,
          country: selectedCountry,
          mode: topicMode,
          plan: userPlan,
        }),
      });

      if (!response.ok) {
        const errorJson = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setOptimizeError(errorJson?.error ?? "Optimizer request failed.");
        return;
      }

      if (!response.body) {
        setOptimizeError("Streaming not available in this environment.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamed = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        streamed += decoder.decode(value, { stream: true });
        setOptimizedPost(streamed);
      }

      streamed += decoder.decode();
      setOptimizedPost(streamed.trim());
    } catch {
      setOptimizeError("Could not reach optimizer API.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const copyToClipboard = async () => {
    if (!trendString) {
      return;
    }
    await navigator.clipboard.writeText(trendString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyOptimizedToClipboard = async () => {
    if (!optimizedPost) {
      return;
    }
    await navigator.clipboard.writeText(optimizedPost);
    setCopiedOptimized(true);
    setTimeout(() => setCopiedOptimized(false), 2000);
  };

  const shareToX = () => {
    const modeLabel =
      topicMode === "hashtags"
        ? "hashtags"
        : topicMode === "regular"
          ? "regular topics"
          : "top trends";
    const text = encodeURIComponent(
      `Top ${modeLabel} in ${selectedCountry} right now: ${trendString}`,
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#0f1419] p-6 font-sans text-white">
      <div className="pointer-events-none absolute top-0 left-1/2 h-64 w-full max-w-2xl -translate-x-1/2 bg-blue-500/10 blur-[120px]" />

      <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-lg bg-blue-500 p-2">
            <TrendingUp size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Swave</h1>
            <p className="text-sm text-gray-400">Maximize your impressions instantly</p>
          </div>
        </div>

        <div className="mb-8">
          {loadError ? (
            <p className="mb-4 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              {loadError}
            </p>
          ) : null}

          <label className="mb-3 block text-xs font-semibold tracking-widest text-blue-400 uppercase">
            Trending By Country
          </label>
          <button
            onClick={scanFreshTopics}
            disabled={isScanning}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/15 px-4 py-3 text-sm font-semibold text-blue-200 transition-colors hover:bg-blue-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={isScanning ? "animate-spin" : undefined}
            />
            {isScanning ? "Scanning..." : "Scan Fresh Topics"}
          </button>

          {scanStatus ? <p className="mb-4 text-xs text-blue-300">{scanStatus}</p> : null}

          <div className="mb-5 flex flex-wrap gap-2">
            {countries.map((country) => (
              <button
                key={country}
                onClick={() => {
                  setSelectedCountry(country);
                  setCopied(false);
                }}
                className={`rounded-full border px-3 py-1 text-sm font-semibold transition-colors ${
                  selectedCountry === country
                    ? "border-blue-400 bg-blue-500/25 text-blue-200"
                    : "border-white/15 bg-white/5 text-gray-300 hover:bg-white/10"
                }`}
              >
                {country}
              </button>
            ))}
          </div>

          <label className="mb-3 block text-xs font-semibold tracking-widest text-blue-400 uppercase">
            Topic View
          </label>
          <div className="mb-5 grid grid-cols-3 gap-2">
            <button
              onClick={() => {
                setTopicMode("all");
                setCopied(false);
              }}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                topicMode === "all"
                  ? "border-blue-400 bg-blue-500/25 text-blue-200"
                  : "border-white/15 bg-white/5 text-gray-300 hover:bg-white/10"
              }`}
            >
              All Topics
            </button>
            <button
              onClick={() => {
                setTopicMode("hashtags");
                setCopied(false);
              }}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                topicMode === "hashtags"
                  ? "border-blue-400 bg-blue-500/25 text-blue-200"
                  : "border-white/15 bg-white/5 text-gray-300 hover:bg-white/10"
              }`}
            >
              Hashtags
            </button>
            <button
              onClick={() => {
                setTopicMode("regular");
                setCopied(false);
              }}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                topicMode === "regular"
                  ? "border-blue-400 bg-blue-500/25 text-blue-200"
                  : "border-white/15 bg-white/5 text-gray-300 hover:bg-white/10"
              }`}
            >
              Regular
            </button>
          </div>

          <label className="mb-3 block text-xs font-semibold tracking-widest text-blue-400 uppercase">
            {topicMode === "hashtags"
              ? `Top Hashtags In ${selectedCountry}`
              : topicMode === "regular"
                ? `Top Regular Topics In ${selectedCountry}`
                : `Top Trending In ${selectedCountry}`}
          </label>
          <div className="flex min-h-[120px] flex-wrap gap-2 rounded-2xl border border-white/5 bg-black/40 p-4">
            {visibleTrends.length > 0 ? (
              visibleTrends.map((trend, index) => (
                <span
                  key={`${trend}-${index}`}
                  className="cursor-default rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/20"
                >
                  {trend}
                </span>
              ))
            ) : (
              <p className="text-sm text-gray-400">No topics available yet for this country.</p>
            )}
          </div>
          {currentTimestamp ? (
            <p className="mt-3 text-xs text-gray-500">Source timestamp: {currentTimestamp}</p>
          ) : null}
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4">
          <button
            onClick={copyToClipboard}
            disabled={visibleTrends.length === 0}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white py-4 font-bold text-black transition-all hover:bg-gray-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {copied ? <Check size={20} /> : <Copy size={20} />}
            {copied ? "Copied!" : "Copy Trends"}
          </button>

          <button
            onClick={shareToX}
            disabled={visibleTrends.length === 0}
            className="flex items-center justify-center gap-2 rounded-2xl bg-black py-4 font-bold text-white transition-all hover:bg-neutral-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5 fill-current"
            >
              <path d="M18.244 2H21.5l-7.11 8.13L22.75 22h-6.54l-5.12-6.7L5.23 22H2l7.6-8.68L1.25 2h6.7l4.62 6.1zM17.11 20h1.8L6.97 3.9H5.03z" />
            </svg>
            Post to X
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <WandSparkles size={18} className="text-blue-300" />
              <h2 className="text-lg font-semibold text-white">AI Post Optimizer</h2>
            </div>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">
              +42% Projected Reach
            </span>
          </div>

          <p className="mb-4 text-xs text-gray-400">
            Free users can view trends only. Pro users can click Boost Me for a streamed Claude rewrite.
          </p>

          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setUserPlan("free")}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                userPlan === "free"
                  ? "border-slate-300/60 bg-slate-200/20 text-slate-100"
                  : "border-white/15 bg-white/5 text-gray-300 hover:bg-white/10"
              }`}
            >
              Free Plan
            </button>
            <button
              onClick={() => setUserPlan("pro")}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                userPlan === "pro"
                  ? "border-amber-300/70 bg-amber-300/20 text-amber-100"
                  : "border-white/15 bg-white/5 text-gray-300 hover:bg-white/10"
              }`}
            >
              Pro Plan ($19/mo)
            </button>
          </div>

          <textarea
            value={userPost}
            onChange={(event) => setUserPost(event.target.value)}
            placeholder="Paste your draft post here..."
            rows={5}
            className="w-full resize-y rounded-xl border border-white/10 bg-[#0b1016] px-4 py-3 text-sm text-white outline-none ring-blue-400/40 placeholder:text-gray-500 focus:ring"
          />

          <div className="mt-3 mb-4 flex items-center justify-between">
            <p className="text-xs text-gray-500">Draft length: {userPost.length} chars</p>
            <p className="text-xs text-gray-500">
              Trend context: {visibleTrends.slice(0, 3).join(" | ") || "none"}
            </p>
          </div>

          <button
            onClick={optimizePost}
            disabled={isOptimizing || !userPost.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-400/35 bg-blue-500/20 px-4 py-3 text-sm font-semibold text-blue-100 transition-colors hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <WandSparkles size={16} />
            {isOptimizing ? "Boosting..." : "Boost Me"}
          </button>

          {optimizeError ? (
            <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {optimizeError}
            </p>
          ) : null}

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-[#0e151d] p-4">
              <p className="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">Old Post</p>
              <p className="whitespace-pre-line text-sm text-gray-100">
                {userPost.trim() || "Your original draft will appear here."}
              </p>
            </div>
            <div className="rounded-xl border border-blue-400/30 bg-[#0f1a25] p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold tracking-wide text-blue-300 uppercase">
                  Optimized Post
                </p>
                <button
                  onClick={copyOptimizedToClipboard}
                  disabled={!optimizedPost}
                  className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-gray-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {copiedOptimized ? <Check size={14} /> : <Copy size={14} />}
                  {copiedOptimized ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="whitespace-pre-line text-sm text-gray-100">
                {optimizedPost || (isOptimizing ? "Streaming optimized rewrite..." : "Boosted post will stream here.")}
              </p>
              {optimizedPost ? (
                <p className="mt-2 text-xs text-gray-500">{optimizedPost.length}/280</p>
              ) : null}
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          Adding relevant trends can increase reach by up to 40%.
          <br />
          Use responsibly to avoid spam filters.
        </p>

        {source || generatedAtUtc ? (
          <p className="mt-4 text-center text-xs text-gray-600">
            {source ? `Data source: ${source}` : ""}
            {source && generatedAtUtc ? " | " : ""}
            {generatedAtUtc ? `Generated: ${generatedAtUtc}` : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}

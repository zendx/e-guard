"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Check, Copy, LogOut, RefreshCw, Save, TrendingUp, WandSparkles } from "lucide-react";
import type { AuthUser, UserUsage } from "@/lib/auth-types";
import InactivityLogout from "@/components/InactivityLogout";

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

type UserContextResponse = {
  user?: AuthUser;
  usage?: UserUsage;
  unreadNotifications?: number;
  error?: string;
};

type TopicMode = "all" | "hashtags" | "regular";

type TwitterGrowthAppProps = {
  user: AuthUser;
};

function normalizeTopicLabel(topic: string): string {
  return topic.replace(/\s+/g, " ").trim();
}

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

export default function TwitterGrowthApp({ user }: TwitterGrowthAppProps) {
  const [currentUser, setCurrentUser] = useState<AuthUser>(user);
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
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [usage, setUsage] = useState<UserUsage | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [usageError, setUsageError] = useState<string | null>(null);

  const [profileName, setProfileName] = useState(user.name);
  const [profileAddress, setProfileAddress] = useState(user.address ?? "");
  const [profileCountry, setProfileCountry] = useState(user.country ?? "");
  const [profileState, setProfileState] = useState(user.state ?? "");
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

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

  const normalizedVisibleTrends = useMemo(
    () =>
      visibleTrends
        .map((topic) => normalizeTopicLabel(topic))
        .filter((topic) => topic.length > 0),
    [visibleTrends],
  );

  const trendString = useMemo(
    () => normalizedVisibleTrends.join(" "),
    [normalizedVisibleTrends],
  );
  const currentTimestamp = countryTimestamps[selectedCountry] ?? null;

  const freeLimitReached =
    currentUser.plan === "free" && (usage?.freeRemaining ?? 0) <= 0;

  const loadUserContext = useCallback(async () => {
    try {
      const response = await fetch("/api/user/context", { cache: "no-store" });
      const data = (await response.json()) as UserContextResponse;
      if (!response.ok) {
        setUsageError(data.error ?? "Failed to load user context.");
        return;
      }

      if (data.user) {
        setCurrentUser(data.user);
      }
      setUsage(data.usage ?? null);
      setUnreadNotifications(
        typeof data.unreadNotifications === "number" ? data.unreadNotifications : 0,
      );
      setUsageError(null);
    } catch {
      setUsageError("Failed to load user context.");
    }
  }, []);

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
          const mergedTopics = Array.from(
            new Set([...allTopics, ...hashtags, ...regularTopics]),
          ).slice(0, 20);

          if (
            mergedTopics.length === 0 &&
            hashtags.length === 0 &&
            regularTopics.length === 0
          ) {
            continue;
          }

          nextAllTrendsByCountry[country] = mergedTopics;
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
        }
      }
    },
    [],
  );

  useEffect(() => {
    let mounted = true;

    void loadUserContext();
    loadTrends(mounted);

    const interval = window.setInterval(() => {
      void loadUserContext();
      void loadTrends(mounted);
    }, 60000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [loadTrends, loadUserContext]);

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

  const logout = async () => {
    setIsLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  const trackAction = async (action: "copy" | "post") => {
    const response = await fetch("/api/user/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    const data = (await response.json().catch(() => null)) as
      | { usage?: UserUsage; error?: string }
      | null;

    if (!response.ok) {
      setUsageError(data?.error ?? "Failed to track usage.");
      return null;
    }

    if (data?.usage) {
      setUsage(data.usage);
      if (data.usage.freeRemaining <= 0) {
        setUsageError("Free limit reached. Upgrade to Pro when available.");
      }
      return data.usage;
    }

    return null;
  };

  const copyToClipboard = async () => {
    if (!trendString || freeLimitReached) {
      setUsageError("Free limit reached. Upgrade to Pro when available.");
      return;
    }

    const nextUsage = await trackAction("copy");
    if (!nextUsage) {
      return;
    }

    await navigator.clipboard.writeText(trendString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareToX = async () => {
    if (freeLimitReached) {
      setUsageError("Free limit reached. Upgrade to Pro when available.");
      return;
    }

    const nextUsage = await trackAction("post");
    if (!nextUsage) {
      return;
    }

    const text = encodeURIComponent(trendString);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
  };

  const saveProfile = async () => {
    setIsSavingProfile(true);
    setProfileStatus(null);

    try {
      const response = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileName,
          address: profileAddress,
          country: profileCountry,
          state: profileState,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { success?: boolean; user?: AuthUser; error?: string }
        | null;

      if (!response.ok || !data?.success || !data.user) {
        setProfileStatus(data?.error ?? "Failed to update profile.");
        return;
      }

      setCurrentUser(data.user);
      setProfileName(data.user.name);
      setProfileAddress(data.user.address);
      setProfileCountry(data.user.country);
      setProfileState(data.user.state);
      setProfileStatus("Profile updated successfully.");
    } catch {
      setProfileStatus("Failed to update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0f1419] p-4 text-white sm:p-6">
      <InactivityLogout />
      <div className="pointer-events-none absolute top-0 left-1/2 h-64 w-full max-w-2xl -translate-x-1/2 bg-blue-500/10 blur-[120px]" />

      <div className="relative mx-auto w-full max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500 p-2">
              <TrendingUp size={22} className="text-white" />
            </div>
            <div>
              <p className="text-lg font-bold">S-Trends Dashboard</p>
              <p className="text-xs text-gray-400">
                Signed in as {currentUser.name} ({currentUser.email})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/notifications"
              className="relative inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-white/10"
            >
              <Bell size={14} />
              Notifications
              {unreadNotifications > 0 ? (
                <span className="absolute -top-2 -right-2 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              ) : null}
            </Link>
            <span className="rounded-full border border-slate-300/40 bg-slate-200/10 px-3 py-1 text-xs font-semibold text-slate-100">
              {currentUser.plan === "pro" ? "Pro Plan" : "Free Plan"}
            </span>
            {currentUser.isAdmin ? (
              <Link
                href="/admin"
                className="rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/20"
              >
                Admin Panel
              </Link>
            ) : null}
            <Link
              href="/pricing"
              className="rounded-lg border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-300/20"
            >
              Pro Coming Soon
            </Link>
            <button
              onClick={logout}
              disabled={isLoggingOut}
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-white/10 disabled:opacity-60"
            >
              <LogOut size={14} />
              {isLoggingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-gray-400">Usage</p>
            <p className="mt-2 text-lg font-bold">{usage ? `${usage.usageCount}/${usage.freeLimit}` : "--"}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-gray-400">Copy Clicks</p>
            <p className="mt-2 text-lg font-bold">{usage?.copyClicks ?? "--"}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-gray-400">Post to X Clicks</p>
            <p className="mt-2 text-lg font-bold">{usage?.postClicks ?? "--"}</p>
          </div>
        </div>

        {usageError ? (
          <p className="mb-5 rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {usageError}
          </p>
        ) : null}

        <div className="mb-5">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="mb-3 text-sm font-semibold text-cyan-100">Profile / KYC</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-slate-300">Full name</label>
                <input
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-300">Email (unchanged)</label>
                <input
                  value={currentUser.email}
                  disabled
                  className="w-full cursor-not-allowed rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-300">Address</label>
                <input
                  value={profileAddress}
                  onChange={(event) => setProfileAddress(event.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-300">Country</label>
                  <input
                    value={profileCountry}
                    onChange={(event) => setProfileCountry(event.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-300">State</label>
                  <input
                    value={profileState}
                    onChange={(event) => setProfileState(event.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <button
                onClick={saveProfile}
                disabled={isSavingProfile}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-60"
              >
                <Save size={14} />
                {isSavingProfile ? "Saving..." : "Save Profile"}
              </button>
              {profileStatus ? <p className="text-xs text-slate-300">{profileStatus}</p> : null}
              <div className="pt-2">
                <Link
                  href="/delete-account"
                  className="inline-flex rounded-lg border border-rose-300/50 bg-rose-400/15 px-4 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-400/25"
                >
                  Delete Account
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl sm:p-8">
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
            <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
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
            <div
              className={`flex min-h-[120px] flex-wrap gap-2 rounded-2xl border border-white/5 bg-black/40 p-4 transition ${
                freeLimitReached ? "blur-[3px] opacity-60" : ""
              }`}
            >
              {normalizedVisibleTrends.length > 0 ? (
                <ol className="grid w-full gap-2 sm:grid-cols-2">
                  {normalizedVisibleTrends.map((trend, index) => (
                    <li
                      key={`${trend}-${index}`}
                      className="flex items-start gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2"
                    >
                      <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500/30 px-1 text-[10px] font-bold text-blue-100">
                        {index + 1}
                      </span>
                      <span
                        title={trend}
                        className="text-sm leading-5 font-medium text-blue-200 break-words"
                      >
                        {trend}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-gray-400">No topics available yet for this country.</p>
              )}
            </div>
            {currentTimestamp ? (
              <p className="mt-3 text-xs text-gray-500">Source timestamp: {currentTimestamp}</p>
            ) : null}
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              onClick={copyToClipboard}
              disabled={normalizedVisibleTrends.length === 0 || freeLimitReached}
              className="flex items-center justify-center gap-2 rounded-2xl bg-white py-4 font-bold text-black transition-all hover:bg-gray-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {copied ? <Check size={20} /> : <Copy size={20} />}
              {copied ? "Copied!" : "Copy Trends"}
            </button>

            <button
              onClick={shareToX}
              disabled={normalizedVisibleTrends.length === 0 || freeLimitReached}
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

          <div className="rounded-2xl border border-amber-300/20 bg-amber-400/5 p-5">
            <div className="mb-2 flex items-center gap-2">
              <WandSparkles size={18} className="text-amber-200" />
              <h2 className="text-lg font-semibold text-amber-100">Pro Optimizer (Coming Soon)</h2>
            </div>
            <p className="text-sm text-amber-100/90">
              AI rewrite tools, side-by-side post optimization, and projected reach scoring will launch in the Pro plan.
            </p>
            <Link
              href="/pricing"
              className="mt-4 inline-flex rounded-lg border border-amber-300/35 bg-amber-300/15 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-300/25"
            >
              View Pricing
            </Link>
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
    </div>
  );
}

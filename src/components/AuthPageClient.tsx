"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

type Mode = "register" | "login";

export default function AuthPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialMode = (searchParams.get("mode") === "login" ? "login" : "register") as Mode;
  const proIntent = searchParams.get("intent") === "pro";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [proInterest, setProInterest] = useState(proIntent);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const title = useMemo(
    () => (mode === "register" ? "Create your account" : "Welcome back"),
    [mode],
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const payload =
        mode === "register"
          ? { name, email, password, proInterest }
          : { email, password };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        setError(data?.error ?? "Request failed.");
        setIsLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Request failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#081320] px-4 py-10 text-white">
      <div className="pointer-events-none absolute -top-24 -left-20 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 bottom-0 h-80 w-80 rounded-full bg-blue-600/20 blur-3xl" />

      <div className="relative mx-auto w-full max-w-md rounded-3xl border border-white/15 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-6">
          <Link href="/" className="text-xs font-semibold tracking-[0.24em] text-cyan-300 uppercase">
            S-Trends
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-slate-300">
            Register to use the free dashboard now. Pro features are coming soon.
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/20 p-1">
          <button
            onClick={() => setMode("register")}
            className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
              mode === "register"
                ? "bg-cyan-500/30 text-cyan-100"
                : "text-slate-300 hover:bg-white/5"
            }`}
          >
            Register
          </button>
          <button
            onClick={() => setMode("login")}
            className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
              mode === "login"
                ? "bg-cyan-500/30 text-cyan-100"
                : "text-slate-300 hover:bg-white/5"
            }`}
          >
            Login
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "register" ? (
            <div>
              <label className="mb-1 block text-xs text-slate-300">Full name</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                className="w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                placeholder="John Doe"
              />
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-xs text-slate-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              className="w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
              placeholder="Minimum 8 characters"
            />
          </div>

          {mode === "register" ? (
            <label className="flex items-start gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={proInterest}
                onChange={(event) => setProInterest(event.target.checked)}
                className="mt-0.5"
              />
              Notify me when Pro launches (AI optimizer, team workflows, analytics).
            </label>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
          >
            {isLoading ? "Please wait..." : mode === "register" ? "Create Account" : "Sign In"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-400">
          By continuing, you agree to use S-Trends responsibly.
        </p>
      </div>
    </div>
  );
}

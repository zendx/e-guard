"use client";

import Link from "next/link";
import { useState } from "react";
import InactivityLogout from "@/components/InactivityLogout";

type DeleteAccountPageClientProps = {
  userEmail: string;
};

export default function DeleteAccountPageClient({ userEmail }: DeleteAccountPageClientProps) {
  const [email, setEmail] = useState(userEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const deleteAccount = async () => {
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/user/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;

      if (!response.ok || !data?.success) {
        setError(data?.error ?? "Failed to delete account.");
        return;
      }

      await fetch("/api/auth/logout", { method: "POST" });
      setSuccess("Your account has been deleted.");
      window.location.href = "/auth?mode=login";
    } catch {
      setError("Failed to delete account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0f1419] p-4 text-white sm:p-6">
      <InactivityLogout />
      <div className="pointer-events-none absolute top-0 left-1/2 h-64 w-full max-w-2xl -translate-x-1/2 bg-rose-500/10 blur-[120px]" />

      <div className="relative mx-auto w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-lg font-semibold text-rose-100">Delete Account</p>
        <p className="mt-3 rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
          We would hate to see you go. Deleting your account is permanent and removes your access,
          profile data, and history. If this is about a problem, contact support first and we will
          help.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-300">Confirm your email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-300">Confirm your password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {error ? (
          <p className="mt-3 rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </p>
        ) : null}
        {success ? <p className="mt-3 text-xs text-emerald-200">{success}</p> : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            onClick={deleteAccount}
            disabled={submitting}
            className="rounded-lg border border-rose-300/60 bg-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-500/30 disabled:opacity-60"
          >
            {submitting ? "Deleting..." : "Permanently Delete My Account"}
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}

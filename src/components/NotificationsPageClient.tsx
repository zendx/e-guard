"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import type { UserNotification } from "@/lib/auth-types";
import InactivityLogout from "@/components/InactivityLogout";

type NotificationsResponse = {
  notifications?: UserNotification[];
  unreadCount?: number;
  error?: string;
};

type NotificationsPageClientProps = {
  userName: string;
};

function formatDateTime(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleString();
}

export default function NotificationsPageClient({
  userName,
}: NotificationsPageClientProps) {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/user/notifications", { cache: "no-store" });
      const data = (await response.json()) as NotificationsResponse;
      if (!response.ok) {
        setError(data.error ?? "Failed to load notifications.");
        return;
      }
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
      setError(null);
    } catch {
      setError("Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const markAllRead = async () => {
    setUpdating(true);
    try {
      const response = await fetch("/api/user/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markAllRead" }),
      });
      const data = (await response.json().catch(() => null)) as
        | { unreadCount?: number; error?: string }
        | null;

      if (!response.ok) {
        setError(data?.error ?? "Failed to mark all notifications as read.");
        return;
      }

      setUnreadCount(typeof data?.unreadCount === "number" ? data.unreadCount : 0);
      setNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          isRead: true,
          readAt: notification.readAt ?? new Date().toISOString(),
        })),
      );
      setError(null);
    } catch {
      setError("Failed to mark all notifications as read.");
    } finally {
      setUpdating(false);
    }
  };

  const markRead = async (notificationId: string) => {
    const existing = notifications.find((item) => item.id === notificationId);
    if (!existing || existing.isRead === true) {
      return;
    }

    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notificationId
          ? { ...item, isRead: true, readAt: new Date().toISOString() }
          : item,
      ),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    const response = await fetch("/api/user/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markRead", notificationId }),
    });

    if (!response.ok) {
      setError("Failed to mark notification as read.");
      await loadNotifications();
    }
  };

  const hasNotifications = notifications.length > 0;
  const unreadLabel = useMemo(
    () => `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`,
    [unreadCount],
  );

  return (
    <div className="min-h-screen bg-[#0f1419] px-4 py-6 text-white sm:px-6">
      <InactivityLogout />
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div>
            <p className="text-xs text-slate-400">Signed in as {userName}</p>
            <h1 className="mt-1 text-xl font-bold">Notifications</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
              {unreadLabel}
            </span>
            <button
              onClick={markAllRead}
              disabled={updating || unreadCount === 0}
              className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-50"
            >
              Mark all as read
            </button>
            <Link
              href="/dashboard"
              className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        {error ? (
          <p className="mb-4 rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-300">Loading notifications...</p>
        ) : !hasNotifications ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
            <Bell size={18} className="mx-auto text-slate-400" />
            <p className="mt-2 text-sm text-slate-300">No notifications yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => void markRead(notification.id)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                  notification.isRead
                    ? "border-white/10 bg-black/20"
                    : "border-cyan-300/40 bg-cyan-400/10"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{notification.title}</p>
                    <p className="mt-1 text-xs text-slate-300">{notification.message}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[11px] text-slate-400">
                      {formatDateTime(notification.createdAt)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        notification.isRead
                          ? "bg-white/10 text-slate-300"
                          : "bg-cyan-300/20 text-cyan-100"
                      }`}
                    >
                      {notification.isRead ? "Read" : "Unread"}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

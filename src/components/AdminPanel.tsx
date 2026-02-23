"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AccountDeleteRequest, AuthUser, AuthUserStatus, UserNotification, UserUsage } from "@/lib/auth-types";

type AdminUser = AuthUser & {
  metrics: UserUsage;
  hasPendingDeleteRequest: boolean;
};

type UsersResponse = {
  users?: AdminUser[];
  error?: string;
};

type NotificationsResponse = {
  notifications?: UserNotification[];
  error?: string;
};

type DeleteRequestsResponse = {
  requests?: AccountDeleteRequest[];
  error?: string;
};

type UsageSettingsResponse = {
  globalFreeLimit?: number;
  error?: string;
};

export default function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [deleteRequests, setDeleteRequests] = useState<AccountDeleteRequest[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [loadingDeleteRequests, setLoadingDeleteRequests] = useState(true);
  const [loadingUsageSettings, setLoadingUsageSettings] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"broadcast" | "direct">("broadcast");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [editUserId, setEditUserId] = useState("");
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editState, setEditState] = useState("");
  const [isSavingUserEdit, setIsSavingUserEdit] = useState(false);
  const [usageUserId, setUsageUserId] = useState("");
  const [usageLimitInput, setUsageLimitInput] = useState("");
  const [usageCountInput, setUsageCountInput] = useState("");
  const [globalFreeLimitInput, setGlobalFreeLimitInput] = useState("10");
  const [isSavingUsageSettings, setIsSavingUsageSettings] = useState(false);

  const nonAdminUsers = useMemo(
    () => users.filter((u) => !u.isAdmin),
    [users],
  );

  const selectedEditUser = useMemo(
    () => users.find((u) => u.id === editUserId) ?? null,
    [users, editUserId],
  );
  const selectedUsageUser = useMemo(
    () => users.find((u) => u.id === usageUserId) ?? null,
    [users, usageUserId],
  );

  const hydrateEditForm = (userId: string) => {
    setEditUserId(userId);
    const user = users.find((u) => u.id === userId);
    if (!user) {
      setEditName("");
      setEditAddress("");
      setEditCountry("");
      setEditState("");
      return;
    }
    setEditName(user.name);
    setEditAddress(user.address ?? "");
    setEditCountry(user.country ?? "");
    setEditState(user.state ?? "");
  };

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const data = (await response.json()) as UsersResponse;
      if (!response.ok) {
        setError(data.error ?? "Failed to load users.");
        return;
      }
      const nextUsers = Array.isArray(data.users) ? data.users : [];
      setUsers(nextUsers);
      setError(null);

      if (editUserId) {
        const next = nextUsers.find((u) => u.id === editUserId);
        if (next) {
          setEditName(next.name);
          setEditAddress(next.address ?? "");
          setEditCountry(next.country ?? "");
          setEditState(next.state ?? "");
        }
      }
    } catch {
      setError("Failed to load users.");
    } finally {
      setLoadingUsers(false);
    }
  }, [editUserId]);

  const loadNotifications = useCallback(async () => {
    setLoadingNotifications(true);
    try {
      const response = await fetch("/api/admin/notifications", { cache: "no-store" });
      const data = (await response.json()) as NotificationsResponse;
      if (!response.ok) {
        setError(data.error ?? "Failed to load notifications.");
        return;
      }
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setError(null);
    } catch {
      setError("Failed to load notifications.");
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  const loadDeleteRequests = useCallback(async () => {
    setLoadingDeleteRequests(true);
    try {
      const response = await fetch("/api/admin/delete-requests", { cache: "no-store" });
      const data = (await response.json()) as DeleteRequestsResponse;
      if (!response.ok) {
        setError(data.error ?? "Failed to load delete requests.");
        return;
      }
      setDeleteRequests(Array.isArray(data.requests) ? data.requests : []);
      setError(null);
    } catch {
      setError("Failed to load delete requests.");
    } finally {
      setLoadingDeleteRequests(false);
    }
  }, []);

  const loadUsageSettings = useCallback(async () => {
    setLoadingUsageSettings(true);
    try {
      const response = await fetch("/api/admin/usage-settings", { cache: "no-store" });
      const data = (await response.json()) as UsageSettingsResponse;
      if (!response.ok) {
        setError(data.error ?? "Failed to load usage settings.");
        return;
      }
      setGlobalFreeLimitInput(String(data.globalFreeLimit ?? 10));
      setError(null);
    } catch {
      setError("Failed to load usage settings.");
    } finally {
      setLoadingUsageSettings(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
    void loadNotifications();
    void loadDeleteRequests();
    void loadUsageSettings();
  }, [loadUsers, loadNotifications, loadDeleteRequests, loadUsageSettings]);

  const updateStatus = async (userId: string, status: AuthUserStatus) => {
    const response = await fetch("/api/admin/users/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, status }),
    });

    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setError(data?.error ?? "Failed to update user status.");
      return;
    }

    await loadUsers();
  };

  const directDeleteUser = async (userId: string) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to permanently delete this user account?",
    );
    if (!confirmDelete) {
      return;
    }

    const response = await fetch("/api/admin/users/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setError(data?.error ?? "Failed to delete user.");
      return;
    }

    await Promise.all([loadUsers(), loadDeleteRequests()]);
  };

  const saveUserEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editUserId) {
      return;
    }

    setIsSavingUserEdit(true);
    try {
      const response = await fetch("/api/admin/users/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editUserId,
          name: editName,
          address: editAddress,
          country: editCountry,
          state: editState,
        }),
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(data?.error ?? "Failed to save user profile.");
        return;
      }

      setError(null);
      await loadUsers();
    } catch {
      setError("Failed to save user profile.");
    } finally {
      setIsSavingUserEdit(false);
    }
  };

  const sendNotification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSending(true);

    try {
      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          mode,
          userId: mode === "direct" ? selectedUserId : undefined,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error ?? "Failed to send notification.");
        return;
      }

      setTitle("");
      setMessage("");
      setSelectedUserId("");
      setError(null);
      await loadNotifications();
    } catch {
      setError("Failed to send notification.");
    } finally {
      setIsSending(false);
    }
  };

  const resolveDeleteRequest = async (requestId: string, action: "approve" | "reject") => {
    const response = await fetch("/api/admin/delete-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, action }),
    });

    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setError(data?.error ?? "Failed to resolve delete request.");
      return;
    }

    await Promise.all([loadDeleteRequests(), loadUsers()]);
  };

  const saveGlobalUsageLimit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingUsageSettings(true);
    try {
      const parsed = Number.parseInt(globalFreeLimitInput, 10);
      const response = await fetch("/api/admin/usage-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ globalFreeLimit: parsed }),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; globalFreeLimit?: number }
        | null;

      if (!response.ok) {
        setError(data?.error ?? "Failed to save global usage limit.");
        return;
      }

      setGlobalFreeLimitInput(String(data?.globalFreeLimit ?? parsed));
      setError(null);
      await loadUsers();
    } catch {
      setError("Failed to save global usage limit.");
    } finally {
      setIsSavingUsageSettings(false);
    }
  };

  const hydrateUserUsageForm = (userId: string) => {
    setUsageUserId(userId);
    const user = users.find((u) => u.id === userId);
    if (!user) {
      setUsageLimitInput("");
      setUsageCountInput("");
      return;
    }
    setUsageLimitInput(user.metrics.limitOverride ? String(user.metrics.limitOverride) : "");
    setUsageCountInput(String(user.metrics.usageCount));
  };

  const saveUserUsageControls = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!usageUserId) {
      return;
    }
    setIsSavingUsageSettings(true);
    try {
      const usageLimitOverride =
        usageLimitInput.trim() === "" ? null : Number.parseInt(usageLimitInput, 10);
      const usageCount =
        usageCountInput.trim() === "" ? null : Number.parseInt(usageCountInput, 10);

      const response = await fetch("/api/admin/users/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: usageUserId,
          usageLimitOverride,
          usageCount,
        }),
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(data?.error ?? "Failed to save user usage controls.");
        return;
      }

      setError(null);
      await loadUsers();
    } catch {
      setError("Failed to save user usage controls.");
    } finally {
      setIsSavingUsageSettings(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1320] px-6 py-8 text-white">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <p className="text-sm text-slate-300">
              Manage users, KYC data, notifications, delete requests, and usage metrics.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-white/10"
          >
            Back to Dashboard
          </Link>
        </div>

        {error ? (
          <p className="mb-4 rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </p>
        ) : null}

        <div className="mb-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-3 text-lg font-semibold">Usage Controls</h2>
            <form onSubmit={saveGlobalUsageLimit} className="mb-4 space-y-2">
              <label className="block text-xs text-slate-300">Sitewide free usage limit</label>
              <div className="flex gap-2">
                <input
                  value={globalFreeLimitInput}
                  onChange={(event) => setGlobalFreeLimitInput(event.target.value)}
                  className="w-40 rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm"
                  disabled={loadingUsageSettings}
                />
                <button
                  type="submit"
                  disabled={isSavingUsageSettings || loadingUsageSettings}
                  className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-60"
                >
                  Save Global
                </button>
              </div>
            </form>

            <form onSubmit={saveUserUsageControls} className="space-y-2">
              <label className="block text-xs text-slate-300">Per-user usage control</label>
              <select
                value={usageUserId}
                onChange={(event) => hydrateUserUsageForm(event.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm"
                required
              >
                <option value="">Select user</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  value={usageLimitInput}
                  onChange={(event) => setUsageLimitInput(event.target.value)}
                  placeholder="Limit override (blank = global)"
                  className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm"
                  disabled={!selectedUsageUser}
                />
                <input
                  value={usageCountInput}
                  onChange={(event) => setUsageCountInput(event.target.value)}
                  placeholder="Current usage count"
                  className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm"
                  disabled={!selectedUsageUser}
                />
              </div>
              <button
                type="submit"
                disabled={isSavingUsageSettings || !selectedUsageUser}
                className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-60"
              >
                Save User Usage
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-3 text-lg font-semibold">Send Notification</h2>
            <form onSubmit={sendNotification} className="space-y-3">
              <div className="grid gap-2 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMode("broadcast")}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold uppercase ${
                    mode === "broadcast"
                      ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-100"
                      : "border-white/20 bg-white/5 text-slate-300"
                  }`}
                >
                  Broadcast
                </button>
                <button
                  type="button"
                  onClick={() => setMode("direct")}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold uppercase ${
                    mode === "direct"
                      ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-100"
                      : "border-white/20 bg-white/5 text-slate-300"
                  }`}
                >
                  Dedicated
                </button>
              </div>

              {mode === "direct" ? (
                <select
                  value={selectedUserId}
                  onChange={(event) => setSelectedUserId(event.target.value)}
                  required
                  className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm"
                >
                  <option value="">Select user</option>
                  {nonAdminUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              ) : null}

              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                placeholder="Notification title"
                className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm"
              />
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                required
                placeholder="Notification message"
                rows={3}
                className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm"
              />

              <button
                type="submit"
                disabled={isSending}
                className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-60"
              >
                {isSending ? "Sending..." : "Send Notification"}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-3 text-lg font-semibold">Edit User Data</h2>
            <form onSubmit={saveUserEdit} className="space-y-3">
              <select
                value={editUserId}
                onChange={(event) => hydrateEditForm(event.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm"
                required
              >
                <option value="">Select user to edit</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>

              <input
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                placeholder="Full name"
                className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm"
                required
                disabled={!selectedEditUser}
              />
              <input
                value={editAddress}
                onChange={(event) => setEditAddress(event.target.value)}
                placeholder="Address"
                className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm"
                disabled={!selectedEditUser}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={editCountry}
                  onChange={(event) => setEditCountry(event.target.value)}
                  placeholder="Country"
                  className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm"
                  disabled={!selectedEditUser}
                />
                <input
                  value={editState}
                  onChange={(event) => setEditState(event.target.value)}
                  placeholder="State"
                  className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm"
                  disabled={!selectedEditUser}
                />
              </div>

              <button
                type="submit"
                disabled={isSavingUserEdit || !selectedEditUser}
                className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-60"
              >
                {isSavingUserEdit ? "Saving..." : "Save User Data"}
              </button>
            </form>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-3 text-lg font-semibold">Delete Requests</h2>
          {loadingDeleteRequests ? (
            <p className="text-sm text-slate-300">Loading delete requests...</p>
          ) : deleteRequests.length === 0 ? (
            <p className="text-sm text-slate-300">No delete requests yet.</p>
          ) : (
            <div className="space-y-2">
              {deleteRequests.map((req) => (
                <div key={req.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <p className="text-sm font-semibold text-white">
                    {req.userEmail} - {req.status}
                  </p>
                  <p className="text-xs text-slate-300">Reason: {req.reason}</p>
                  <p className="mt-1 text-[10px] text-slate-500">Created: {req.createdAt}</p>
                  {req.status === "pending" ? (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => resolveDeleteRequest(req.id, "approve")}
                        className="rounded border border-rose-300/40 bg-rose-400/20 px-2 py-1 text-xs"
                      >
                        Approve + Delete Account
                      </button>
                      <button
                        onClick={() => resolveDeleteRequest(req.id, "reject")}
                        className="rounded border border-emerald-300/40 bg-emerald-400/20 px-2 py-1 text-xs"
                      >
                        Reject Request
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-3 text-lg font-semibold">Users</h2>
          {loadingUsers ? (
            <p className="text-sm text-slate-300">Loading users...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-300 uppercase">
                  <tr>
                    <th className="pb-2">User</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">KYC</th>
                    <th className="pb-2">Copy</th>
                    <th className="pb-2">Post</th>
                    <th className="pb-2">Usage</th>
                    <th className="pb-2">Delete Req</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-white/10 align-top">
                      <td className="py-2">
                        <p className="font-semibold text-white">{u.name}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </td>
                      <td className="py-2">{u.status}</td>
                      <td className="py-2 text-xs text-slate-300">
                        <p>{u.country || "-"}</p>
                        <p>{u.state || "-"}</p>
                      </td>
                      <td className="py-2">{u.metrics.copyClicks}</td>
                      <td className="py-2">{u.metrics.postClicks}</td>
                      <td className="py-2">{u.metrics.usageCount}/{u.metrics.freeLimit}</td>
                      <td className="py-2">{u.hasPendingDeleteRequest ? "Pending" : "-"}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          <button
                            onClick={() => updateStatus(u.id, "active")}
                            className="rounded border border-emerald-300/40 bg-emerald-300/15 px-2 py-1 text-xs"
                          >
                            Activate
                          </button>
                          <button
                            onClick={() => updateStatus(u.id, "suspended")}
                            className="rounded border border-amber-300/40 bg-amber-300/15 px-2 py-1 text-xs"
                          >
                            Suspend
                          </button>
                          <button
                            onClick={() => updateStatus(u.id, "disabled")}
                            className="rounded border border-rose-300/40 bg-rose-300/15 px-2 py-1 text-xs"
                          >
                            Disable
                          </button>
                          {!u.isAdmin ? (
                            <button
                              onClick={() => directDeleteUser(u.id)}
                              className="rounded border border-rose-500/50 bg-rose-500/20 px-2 py-1 text-xs"
                            >
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-3 text-lg font-semibold">Recent Notifications</h2>
          {loadingNotifications ? (
            <p className="text-sm text-slate-300">Loading notifications...</p>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-slate-300">No notifications yet.</p>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <div key={n.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <p className="text-sm font-semibold">
                    {n.title} {n.isBroadcast ? "(Broadcast)" : "(Direct)"}
                  </p>
                  <p className="text-xs text-slate-300">{n.message}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{n.createdAt}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

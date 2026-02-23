import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type {
  AccountDeleteRequest,
  AuthUser,
  AuthUserStatus,
  DeleteRequestStatus,
  UserNotification,
  UserUsage,
} from "@/lib/auth-types";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const SESSION_COOKIE_NAME = "swave_session";
export const DEFAULT_FREE_USAGE_LIMIT = 10;
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

const USERS_TABLE = "app_users";
const SESSIONS_TABLE = "app_sessions";
const METRICS_TABLE = "user_metrics";
const NOTIFICATIONS_TABLE = "notifications";
const DELETE_REQUESTS_TABLE = "account_delete_requests";
const APP_SETTINGS_TABLE = "app_settings";

type UserPlan = "free" | "pro";

type DbUser = {
  id: string;
  name: string;
  email: string;
  address: string;
  country: string;
  state: string;
  password_hash: string;
  plan: UserPlan;
  pro_interest: boolean;
  is_admin: boolean;
  status: AuthUserStatus;
  created_at: string;
};

type DbSession = {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
};

type DbMetric = {
  user_id: string;
  usage_count: number;
  copy_clicks: number;
  post_clicks: number;
  usage_limit_override: number | null;
};

type DbSetting = {
  key: string;
  value: string;
};

type DbNotification = {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  is_broadcast: boolean;
  created_at: string;
};

type DbDeleteRequest = {
  id: string;
  user_id: string;
  user_email: string;
  reason: string;
  status: DeleteRequestStatus;
  created_at: string;
  reviewed_at: string | null;
};

function normalizeText(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

function normalizeLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_FREE_USAGE_LIMIT;
  }
  return Math.min(1000, Math.max(1, Math.floor(value)));
}

function toAuthUser(user: DbUser): AuthUser {
  const statusValue =
    user.status === "active" || user.status === "suspended" || user.status === "disabled"
      ? user.status
      : "active";
  const planValue = user.plan === "pro" ? "pro" : "free";

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    address: typeof user.address === "string" ? user.address : "",
    country: typeof user.country === "string" ? user.country : "",
    state: typeof user.state === "string" ? user.state : "",
    plan: planValue,
    proInterest: user.pro_interest === true,
    isAdmin: user.is_admin === true,
    status: statusValue,
    createdAt: user.created_at,
  };
}

function toUsage(metric: DbMetric | null, globalFreeLimit: number): UserUsage {
  const normalizedGlobalLimit = normalizeLimit(globalFreeLimit);
  const limitOverrideRaw = metric?.usage_limit_override;
  const limitOverride =
    typeof limitOverrideRaw === "number" && limitOverrideRaw > 0
      ? normalizeLimit(limitOverrideRaw)
      : null;
  const effectiveLimit = limitOverride ?? normalizedGlobalLimit;
  const usageCount = metric?.usage_count ?? 0;
  const copyClicks = metric?.copy_clicks ?? 0;
  const postClicks = metric?.post_clicks ?? 0;
  const freeRemaining = Math.max(0, effectiveLimit - usageCount);

  return {
    usageCount,
    copyClicks,
    postClicks,
    globalFreeLimit: normalizedGlobalLimit,
    limitOverride,
    freeLimit: effectiveLimit,
    freeRemaining,
  };
}

async function getGlobalFreeUsageLimit(): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(APP_SETTINGS_TABLE)
    .select("key,value")
    .eq("key", "free_usage_limit")
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_FREE_USAGE_LIMIT;
  }

  const setting = data as DbSetting;
  const parsed = Number.parseInt(setting.value, 10);
  return normalizeLimit(parsed);
}

function toDeleteRequest(row: DbDeleteRequest): AccountDeleteRequest {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hashHex] = storedHash.split(":");
  if (!salt || !hashHex) {
    return false;
  }

  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, expected.length);

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

function isAdminEmail(email: string): boolean {
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

async function createSession(userId: string): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const now = Date.now();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(now + SESSION_DURATION_MS).toISOString();

  await supabase
    .from(SESSIONS_TABLE)
    .delete()
    .lt("expires_at", new Date(now).toISOString());

  const { error } = await supabase.from(SESSIONS_TABLE).insert({
    token,
    user_id: userId,
    created_at: new Date(now).toISOString(),
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }

  return token;
}

async function ensureUserMetricRow(userId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from(METRICS_TABLE)
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read metrics: ${error.message}`);
  }

  if (data) {
    return;
  }

  const { error: insertError } = await supabase.from(METRICS_TABLE).insert({
    user_id: userId,
    usage_count: 0,
    copy_clicks: 0,
    post_clicks: 0,
    usage_limit_override: null,
  });

  if (insertError) {
    throw new Error(`Failed to initialize metrics: ${insertError.message}`);
  }
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  proInterest: boolean;
}): Promise<{ user: AuthUser; sessionToken: string } | { error: string }> {
  const supabase = getSupabaseAdminClient();

  const trimmedName = normalizeText(input.name, 120);
  const normalizedEmail = input.email.trim().toLowerCase();

  if (!trimmedName || trimmedName.length < 2) {
    return { error: "Name must be at least 2 characters." };
  }
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { error: "A valid email is required." };
  }
  if (input.password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const { data: existingUser, error: existingError } = await supabase
    .from(USERS_TABLE)
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingError) {
    return { error: `Failed to validate account uniqueness: ${existingError.message}` };
  }

  if (existingUser) {
    return { error: "An account with this email already exists." };
  }

  const { data: insertedUser, error: insertError } = await supabase
    .from(USERS_TABLE)
    .insert({
      name: trimmedName,
      email: normalizedEmail,
      address: "",
      country: "",
      state: "",
      password_hash: hashPassword(input.password),
      plan: "free",
      pro_interest: input.proInterest,
      is_admin: isAdminEmail(normalizedEmail),
      status: "active",
    })
    .select(
      "id,name,email,address,country,state,password_hash,plan,pro_interest,is_admin,status,created_at",
    )
    .single();

  if (insertError || !insertedUser) {
    return {
      error: `Failed to register account: ${
        insertError?.message ?? "no user row returned after insert"
      }`,
    };
  }

  await ensureUserMetricRow(insertedUser.id);

  const sessionToken = await createSession(insertedUser.id);
  return { user: toAuthUser(insertedUser as DbUser), sessionToken };
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<{ user: AuthUser; sessionToken: string } | { error: string }> {
  const supabase = getSupabaseAdminClient();
  const normalizedEmail = input.email.trim().toLowerCase();

  const { data: userRow, error } = await supabase
    .from(USERS_TABLE)
    .select(
      "id,name,email,address,country,state,password_hash,plan,pro_interest,is_admin,status,created_at",
    )
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error || !userRow) {
    return { error: "Invalid email or password." };
  }

  const user = userRow as DbUser;
  if (!verifyPassword(input.password, user.password_hash)) {
    return { error: "Invalid email or password." };
  }

  if (user.status === "suspended") {
    return { error: "Your account is suspended. Contact support." };
  }
  if (user.status === "disabled") {
    return { error: "Your account is disabled. Contact support." };
  }

  await ensureUserMetricRow(user.id);
  const sessionToken = await createSession(user.id);
  return { user: toAuthUser(user), sessionToken };
}

export async function getUserBySessionToken(token: string): Promise<AuthUser | null> {
  if (!token) {
    return null;
  }

  const supabase = getSupabaseAdminClient();

  const { data: sessionRow, error: sessionError } = await supabase
    .from(SESSIONS_TABLE)
    .select("token,user_id,created_at,expires_at")
    .eq("token", token)
    .maybeSingle();

  if (sessionError || !sessionRow) {
    return null;
  }

  const session = sessionRow as DbSession;
  const now = Date.now();
  if (Date.parse(session.expires_at) <= now) {
    await destroySession(token);
    return null;
  }

  const { data: userRow, error: userError } = await supabase
    .from(USERS_TABLE)
    .select(
      "id,name,email,address,country,state,password_hash,plan,pro_interest,is_admin,status,created_at",
    )
    .eq("id", session.user_id)
    .maybeSingle();

  if (userError || !userRow) {
    return null;
  }

  const user = toAuthUser(userRow as DbUser);
  if (user.status !== "active") {
    await destroySession(token);
    return null;
  }

  return user;
}

export async function destroySession(token: string): Promise<void> {
  if (!token) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  await supabase.from(SESSIONS_TABLE).delete().eq("token", token);
}

export async function getUserUsage(userId: string): Promise<UserUsage> {
  await ensureUserMetricRow(userId);
  const supabase = getSupabaseAdminClient();
  const globalFreeLimit = await getGlobalFreeUsageLimit();

  const { data, error } = await supabase
    .from(METRICS_TABLE)
    .select("user_id,usage_count,copy_clicks,post_clicks,usage_limit_override")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load usage: ${error.message}`);
  }

  return toUsage((data as DbMetric | null) ?? null, globalFreeLimit);
}

export async function trackUserAction(
  userId: string,
  action: "copy" | "post",
): Promise<UserUsage> {
  const usage = await getUserUsage(userId);
  if (usage.usageCount >= usage.freeLimit) {
    return usage;
  }

  const supabase = getSupabaseAdminClient();
  const payload: Record<string, number> = {
    usage_count: usage.usageCount + 1,
    copy_clicks: usage.copyClicks,
    post_clicks: usage.postClicks,
  };

  if (action === "copy") {
    payload.copy_clicks = usage.copyClicks + 1;
  }
  if (action === "post") {
    payload.post_clicks = usage.postClicks + 1;
  }

  const { error } = await supabase
    .from(METRICS_TABLE)
    .update(payload)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to track usage: ${error.message}`);
  }

  return getUserUsage(userId);
}

export async function getNotificationsForUser(userId: string): Promise<UserNotification[]> {
  const supabase = getSupabaseAdminClient();

  const [{ data: directData, error: directError }, { data: broadcastData, error: broadcastError }] =
    await Promise.all([
      supabase
        .from(NOTIFICATIONS_TABLE)
        .select("id,user_id,title,message,is_broadcast,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from(NOTIFICATIONS_TABLE)
        .select("id,user_id,title,message,is_broadcast,created_at")
        .eq("is_broadcast", true)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  if (directError || broadcastError) {
    throw new Error("Failed to load notifications.");
  }

  const merged = [...(directData ?? []), ...(broadcastData ?? [])] as DbNotification[];
  merged.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  return merged.slice(0, 20).map((row) => ({
    id: row.id,
    title: row.title,
    message: row.message,
    isBroadcast: row.is_broadcast,
    createdAt: row.created_at,
  }));
}

export async function sendNotification(input: {
  title: string;
  message: string;
  recipientUserId?: string;
  broadcast: boolean;
}): Promise<{ success: true } | { error: string }> {
  const title = normalizeText(input.title, 160);
  const message = normalizeText(input.message, 1200);

  if (!title || !message) {
    return { error: "Title and message are required." };
  }

  if (!input.broadcast && !input.recipientUserId) {
    return { error: "Recipient user is required for dedicated notifications." };
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from(NOTIFICATIONS_TABLE).insert({
    title,
    message,
    is_broadcast: input.broadcast,
    user_id: input.broadcast ? null : input.recipientUserId,
  });

  if (error) {
    return { error: "Failed to send notification." };
  }

  return { success: true };
}

export async function getUserProfile(userId: string): Promise<AuthUser> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select(
      "id,name,email,address,country,state,password_hash,plan,pro_interest,is_admin,status,created_at",
    )
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new Error("Failed to load user profile.");
  }

  return toAuthUser(data as DbUser);
}

export async function updateOwnProfile(input: {
  userId: string;
  name: string;
  address: string;
  country: string;
  state: string;
}): Promise<{ user: AuthUser } | { error: string }> {
  const name = normalizeText(input.name, 120);
  const address = normalizeText(input.address, 300);
  const country = normalizeText(input.country, 120);
  const state = normalizeText(input.state, 120);

  if (!name || name.length < 2) {
    return { error: "Full name must be at least 2 characters." };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .update({ name, address, country, state })
    .eq("id", input.userId)
    .select(
      "id,name,email,address,country,state,password_hash,plan,pro_interest,is_admin,status,created_at",
    )
    .single();

  if (error || !data) {
    return { error: "Failed to update profile." };
  }

  return { user: toAuthUser(data as DbUser) };
}

export async function createDeleteRequest(input: {
  user: AuthUser;
  reason: string;
}): Promise<{ success: true } | { error: string }> {
  const reason = normalizeText(input.reason, 800);
  if (!reason) {
    return { error: "Reason is required." };
  }

  const supabase = getSupabaseAdminClient();
  const { data: pending } = await supabase
    .from(DELETE_REQUESTS_TABLE)
    .select("id")
    .eq("user_id", input.user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (pending) {
    return { error: "You already have a pending delete request." };
  }

  const { error } = await supabase.from(DELETE_REQUESTS_TABLE).insert({
    user_id: input.user.id,
    user_email: input.user.email,
    reason,
    status: "pending",
  });

  if (error) {
    return { error: "Failed to create delete request." };
  }

  return { success: true };
}

export async function getPendingDeleteRequestForUser(
  userId: string,
): Promise<AccountDeleteRequest | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(DELETE_REQUESTS_TABLE)
    .select("id,user_id,user_email,reason,status,created_at,reviewed_at")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return toDeleteRequest(data as DbDeleteRequest);
}

export async function listUsersForAdmin(): Promise<
  Array<
    AuthUser & {
      metrics: UserUsage;
      hasPendingDeleteRequest: boolean;
    }
  >
> {
  const supabase = getSupabaseAdminClient();

  const { data: usersData, error: usersError } = await supabase
    .from(USERS_TABLE)
    .select(
      "id,name,email,address,country,state,password_hash,plan,pro_interest,is_admin,status,created_at",
    )
    .order("created_at", { ascending: false });

  if (usersError) {
    throw new Error(`Failed to load users: ${usersError.message}`);
  }

  const users = ((usersData ?? []) as DbUser[]).map(toAuthUser);
  const userIds = users.map((u) => u.id);
  const globalFreeLimit = await getGlobalFreeUsageLimit();
  if (userIds.length === 0) {
    return [];
  }

  const [metricsQuery, deleteRequestsQuery] = await Promise.all([
    supabase
      .from(METRICS_TABLE)
      .select("user_id,usage_count,copy_clicks,post_clicks,usage_limit_override")
      .in("user_id", userIds),
    supabase
      .from(DELETE_REQUESTS_TABLE)
      .select("user_id,status")
      .eq("status", "pending")
      .in("user_id", userIds),
  ]);

  const metricsMap = new Map<string, DbMetric>();
  for (const metric of (metricsQuery.data ?? []) as DbMetric[]) {
    metricsMap.set(metric.user_id, metric);
  }

  const pendingSet = new Set<string>();
  for (const req of (deleteRequestsQuery.data ?? []) as Array<{ user_id: string }>) {
    pendingSet.add(req.user_id);
  }

  return users.map((user) => ({
    ...user,
    metrics: toUsage(metricsMap.get(user.id) ?? null, globalFreeLimit),
    hasPendingDeleteRequest: pendingSet.has(user.id),
  }));
}

export async function updateUserStatus(input: {
  userId: string;
  status: AuthUserStatus;
}): Promise<{ success: true } | { error: string }> {
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase
    .from(USERS_TABLE)
    .update({ status: input.status })
    .eq("id", input.userId);

  if (error) {
    return { error: "Failed to update user status." };
  }

  if (input.status !== "active") {
    await supabase.from(SESSIONS_TABLE).delete().eq("user_id", input.userId);
  }

  return { success: true };
}

export async function adminUpdateUserProfile(input: {
  userId: string;
  name: string;
  address: string;
  country: string;
  state: string;
}): Promise<{ success: true } | { error: string }> {
  const name = normalizeText(input.name, 120);
  const address = normalizeText(input.address, 300);
  const country = normalizeText(input.country, 120);
  const state = normalizeText(input.state, 120);

  if (!name || name.length < 2) {
    return { error: "Full name must be at least 2 characters." };
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from(USERS_TABLE)
    .update({ name, address, country, state })
    .eq("id", input.userId);

  if (error) {
    return { error: "Failed to update user profile." };
  }

  return { success: true };
}

export async function adminDeleteUser(input: {
  userId: string;
}): Promise<{ success: true } | { error: string }> {
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase.from(USERS_TABLE).delete().eq("id", input.userId);
  if (error) {
    return { error: "Failed to delete user account." };
  }

  return { success: true };
}

export async function listDeleteRequestsForAdmin(): Promise<AccountDeleteRequest[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(DELETE_REQUESTS_TABLE)
    .select("id,user_id,user_email,reason,status,created_at,reviewed_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error("Failed to load delete requests.");
  }

  return ((data ?? []) as DbDeleteRequest[]).map(toDeleteRequest);
}

export async function resolveDeleteRequest(input: {
  requestId: string;
  action: "approve" | "reject";
}): Promise<{ success: true } | { error: string }> {
  const supabase = getSupabaseAdminClient();

  const { data: reqRow, error: reqError } = await supabase
    .from(DELETE_REQUESTS_TABLE)
    .select("id,user_id,user_email,reason,status,created_at,reviewed_at")
    .eq("id", input.requestId)
    .single();

  if (reqError || !reqRow) {
    return { error: "Delete request not found." };
  }

  const request = reqRow as DbDeleteRequest;
  if (request.status !== "pending") {
    return { error: "Delete request already processed." };
  }

  if (input.action === "reject") {
    const { error } = await supabase
      .from(DELETE_REQUESTS_TABLE)
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", input.requestId);

    if (error) {
      return { error: "Failed to reject delete request." };
    }
    return { success: true };
  }

  const { error: approveError } = await supabase
    .from(DELETE_REQUESTS_TABLE)
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", input.requestId);

  if (approveError) {
    return { error: "Failed to approve delete request." };
  }

  const { error: deleteError } = await supabase
    .from(USERS_TABLE)
    .delete()
    .eq("id", request.user_id);

  if (deleteError) {
    return { error: "Delete request approved but failed to delete user." };
  }

  return { success: true };
}

export async function getAdminUsageSettings(): Promise<{
  globalFreeLimit: number;
}> {
  const globalFreeLimit = await getGlobalFreeUsageLimit();
  return { globalFreeLimit };
}

export async function setGlobalFreeUsageLimit(limit: number): Promise<
  { success: true; globalFreeLimit: number } | { error: string }
> {
  const normalized = normalizeLimit(limit);
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase.from(APP_SETTINGS_TABLE).upsert(
    {
      key: "free_usage_limit",
      value: String(normalized),
    },
    { onConflict: "key" },
  );

  if (error) {
    return { error: "Failed to update global usage limit." };
  }

  return { success: true, globalFreeLimit: normalized };
}

export async function updateUserUsageControls(input: {
  userId: string;
  usageLimitOverride: number | null;
  usageCount: number | null;
}): Promise<{ success: true } | { error: string }> {
  await ensureUserMetricRow(input.userId);
  const supabase = getSupabaseAdminClient();

  const payload: Record<string, number | null> = {};
  if (input.usageLimitOverride === null) {
    payload.usage_limit_override = null;
  } else {
    payload.usage_limit_override = normalizeLimit(input.usageLimitOverride);
  }

  if (input.usageCount !== null) {
    payload.usage_count = Math.max(0, Math.floor(input.usageCount));
  }

  const { error } = await supabase
    .from(METRICS_TABLE)
    .update(payload)
    .eq("user_id", input.userId);

  if (error) {
    return { error: "Failed to update user usage controls." };
  }

  return { success: true };
}

export async function getAdminNotifications(): Promise<UserNotification[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from(NOTIFICATIONS_TABLE)
    .select("id,user_id,title,message,is_broadcast,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error("Failed to load admin notifications.");
  }

  return ((data ?? []) as DbNotification[]).map((row) => ({
    id: row.id,
    title: row.title,
    message: row.message,
    isBroadcast: row.is_broadcast,
    createdAt: row.created_at,
  }));
}

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const hasSupabaseRateLimit =
  Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; resetAt: number };

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

function checkMemoryRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { ok: false, resetAt: existing.resetAt };
  }

  existing.count += 1;
  buckets.set(key, existing);
  return { ok: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (!hasSupabaseRateLimit) {
    return checkMemoryRateLimit(key, limit, windowMs);
  }

  try {
    const { getSupabaseAdminClient } = await import("@/lib/supabase-server");
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .rpc("check_app_rate_limit", {
        p_key: key,
        p_limit: limit,
        p_window_ms: windowMs,
      })
      .single();

    if (error || !data) {
      return checkMemoryRateLimit(key, limit, windowMs);
    }

    const row = data as { ok: boolean; remaining: number; reset_at: string };
    const resetAt = Date.parse(row.reset_at);
    if (row.ok) {
      return {
        ok: true,
        remaining: Math.max(0, Number(row.remaining) || 0),
        resetAt: Number.isFinite(resetAt) ? resetAt : Date.now() + windowMs,
      };
    }

    return {
      ok: false,
      resetAt: Number.isFinite(resetAt) ? resetAt : Date.now() + windowMs,
    };
  } catch {
    return checkMemoryRateLimit(key, limit, windowMs);
  }
}

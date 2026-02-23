import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth-store";
import type { AuthUser } from "@/lib/auth-types";

export async function getSessionUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? "";
  return getUserBySessionToken(token);
}

export async function requireSessionUser(): Promise<
  { ok: true; user: AuthUser } | { ok: false; response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true, user };
}

export async function requireAdminUser(): Promise<
  { ok: true; user: AuthUser } | { ok: false; response: NextResponse }
> {
  const userResult = await requireSessionUser();
  if (!userResult.ok) {
    return userResult;
  }

  if (userResult.user.isAdmin !== true) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return userResult;
}

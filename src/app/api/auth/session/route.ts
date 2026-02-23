import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? "";

  const user = await getUserBySessionToken(token);
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, user });
}

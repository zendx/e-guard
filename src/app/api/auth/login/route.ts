import { NextResponse } from "next/server";
import { loginUser, SESSION_COOKIE_NAME } from "@/lib/auth-store";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody;
    const ip = getClientIp(request);
    const normalizedEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const rl = checkRateLimit(`login:${ip}:${normalizedEmail}`, 10, 15 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    }

    const result = await loginUser({
      email: normalizedEmail,
      password: typeof body.password === "string" ? body.password : "",
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const response = NextResponse.json({ success: true, user: result.user });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: result.sessionToken,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      priority: "high",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}

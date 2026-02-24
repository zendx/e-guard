import { NextResponse } from "next/server";
import { registerUser, SESSION_COOKIE_NAME } from "@/lib/auth-store";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RegisterBody = {
  name?: string;
  email?: string;
  password?: string;
  proInterest?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterBody;
    const ip = getClientIp(request);
    const rl = checkRateLimit(`register:${ip}`, 8, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many registration attempts. Try again later." },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    }

    const result = await registerUser({
      name: typeof body.name === "string" ? body.name : "",
      email: typeof body.email === "string" ? body.email : "",
      password: typeof body.password === "string" ? body.password : "",
      proInterest: Boolean(body.proInterest),
    });

    if ("error" in result) {
      const status = result.error.includes("already exists") ? 409 : 400;
      return NextResponse.json({ error: result.error }, { status });
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
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }
}

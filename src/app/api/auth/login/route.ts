import { NextResponse } from "next/server";
import { loginUser, SESSION_COOKIE_NAME } from "@/lib/auth-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody;

    const result = await loginUser({
      email: typeof body.email === "string" ? body.email : "",
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
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}

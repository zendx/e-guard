import { NextResponse } from "next/server";
import { deleteOwnAccount } from "@/lib/auth-store";
import { requireSessionUser } from "@/lib/auth-session";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

type Body = {
  email?: string;
  password?: string;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireSessionUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as Body;
    const ip = getClientIp(request);
    const rl = await checkRateLimit(`delete-account:${ip}:${auth.user.id}`, 5, 15 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    }

    const result = await deleteOwnAccount({
      user: auth.user,
      email: typeof body.email === "string" ? body.email : "",
      password: typeof body.password === "string" ? body.password : "",
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete account.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

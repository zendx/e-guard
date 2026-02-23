import { NextResponse } from "next/server";
import { adminDeleteUser } from "@/lib/auth-store";
import { requireAdminUser } from "@/lib/auth-session";

type Body = {
  userId?: string;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as Body;
    const userId = typeof body.userId === "string" ? body.userId : "";

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    if (userId === auth.user.id) {
      return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
    }

    const result = await adminDeleteUser({ userId });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete account.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

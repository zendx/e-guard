import { NextResponse } from "next/server";
import { updateUserStatus } from "@/lib/auth-store";
import type { AuthUserStatus } from "@/lib/auth-types";
import { requireAdminUser } from "@/lib/auth-session";

type Body = {
  userId?: string;
  status?: AuthUserStatus;
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
    const status = body.status;

    if (!userId || (status !== "active" && status !== "suspended" && status !== "disabled")) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    if (userId === auth.user.id && status !== "active") {
      return NextResponse.json(
        { error: "You cannot suspend or disable your own account." },
        { status: 400 },
      );
    }

    const result = await updateUserStatus({ userId, status });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update user.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

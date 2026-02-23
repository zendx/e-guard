import { NextResponse } from "next/server";
import { listUsersForAdmin } from "@/lib/auth-store";
import { requireAdminUser } from "@/lib/auth-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const users = await listUsersForAdmin();
    return NextResponse.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load users.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

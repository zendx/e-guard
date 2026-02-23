import { NextResponse } from "next/server";
import { getNotificationsForUser, getPendingDeleteRequestForUser, getUserUsage } from "@/lib/auth-store";
import { requireSessionUser } from "@/lib/auth-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await requireSessionUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const [usage, notifications, deleteRequest] = await Promise.all([
      getUserUsage(auth.user.id),
      getNotificationsForUser(auth.user.id),
      getPendingDeleteRequestForUser(auth.user.id),
    ]);

    return NextResponse.json({
      user: auth.user,
      usage,
      notifications,
      deleteRequest,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load context.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

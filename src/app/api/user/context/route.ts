import { NextResponse } from "next/server";
import {
  getUnreadNotificationCount,
  getUserUsage,
} from "@/lib/auth-store";
import { requireSessionUser } from "@/lib/auth-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await requireSessionUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const [usage, unreadNotifications] = await Promise.all([
      getUserUsage(auth.user.id),
      getUnreadNotificationCount(auth.user.id),
    ]);

    return NextResponse.json({
      user: auth.user,
      usage,
      unreadNotifications,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load context.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import {
  getNotificationsForUser,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/lib/auth-store";
import { requireSessionUser } from "@/lib/auth-session";

type PatchBody = {
  action?: "markAllRead" | "markRead";
  notificationId?: string;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await requireSessionUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const [notifications, unreadCount] = await Promise.all([
      getNotificationsForUser(auth.user.id),
      getUnreadNotificationCount(auth.user.id),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load notifications.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireSessionUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as PatchBody;

    if (body.action === "markAllRead") {
      const result = await markAllNotificationsAsRead(auth.user.id);
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
    } else if (body.action === "markRead") {
      const notificationId =
        typeof body.notificationId === "string" ? body.notificationId.trim() : "";
      if (!notificationId) {
        return NextResponse.json({ error: "notificationId is required." }, { status: 400 });
      }
      const result = await markNotificationAsRead(auth.user.id, notificationId);
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    const unreadCount = await getUnreadNotificationCount(auth.user.id);
    return NextResponse.json({ success: true, unreadCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update notifications.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

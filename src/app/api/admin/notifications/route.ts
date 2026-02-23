import { NextResponse } from "next/server";
import { getAdminNotifications, sendNotification } from "@/lib/auth-store";
import { requireAdminUser } from "@/lib/auth-session";

type Body = {
  title?: string;
  message?: string;
  mode?: "broadcast" | "direct";
  userId?: string;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const notifications = await getAdminNotifications();
    return NextResponse.json({ notifications });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load notifications.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as Body;
    const mode = body.mode === "direct" ? "direct" : "broadcast";

    const result = await sendNotification({
      title: typeof body.title === "string" ? body.title : "",
      message: typeof body.message === "string" ? body.message : "",
      recipientUserId: typeof body.userId === "string" ? body.userId : undefined,
      broadcast: mode === "broadcast",
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send notification.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

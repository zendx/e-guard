import { NextResponse } from "next/server";
import { trackUserAction } from "@/lib/auth-store";
import { requireSessionUser } from "@/lib/auth-session";

type Body = {
  action?: "copy" | "post";
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
    const action = body.action;

    if (action !== "copy" && action !== "post") {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    const usage = await trackUserAction(auth.user.id, action);
    return NextResponse.json({ usage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to track action.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

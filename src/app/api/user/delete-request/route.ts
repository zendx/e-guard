import { NextResponse } from "next/server";
import { createDeleteRequest } from "@/lib/auth-store";
import { requireSessionUser } from "@/lib/auth-session";

type Body = {
  reason?: string;
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
    const result = await createDeleteRequest({
      user: auth.user,
      reason: typeof body.reason === "string" ? body.reason : "",
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit delete request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

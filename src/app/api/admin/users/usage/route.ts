import { NextResponse } from "next/server";
import { updateUserUsageControls } from "@/lib/auth-store";
import { requireAdminUser } from "@/lib/auth-session";

type Body = {
  userId?: string;
  usageLimitOverride?: number | null;
  usageCount?: number | null;
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

    const usageLimitOverride =
      body.usageLimitOverride === null || typeof body.usageLimitOverride === "number"
        ? body.usageLimitOverride
        : null;

    const usageCount =
      body.usageCount === null || typeof body.usageCount === "number"
        ? body.usageCount
        : null;

    const result = await updateUserUsageControls({
      userId,
      usageLimitOverride,
      usageCount,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update usage controls.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

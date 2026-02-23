import { NextResponse } from "next/server";
import { getAdminUsageSettings, setGlobalFreeUsageLimit } from "@/lib/auth-store";
import { requireAdminUser } from "@/lib/auth-session";

type Body = {
  globalFreeLimit?: number;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const settings = await getAdminUsageSettings();
    return NextResponse.json(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load usage settings.";
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
    if (typeof body.globalFreeLimit !== "number") {
      return NextResponse.json({ error: "globalFreeLimit is required." }, { status: 400 });
    }

    const result = await setGlobalFreeUsageLimit(body.globalFreeLimit);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update usage settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

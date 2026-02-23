import { NextResponse } from "next/server";
import { listDeleteRequestsForAdmin, resolveDeleteRequest } from "@/lib/auth-store";
import { requireAdminUser } from "@/lib/auth-session";

type Body = {
  requestId?: string;
  action?: "approve" | "reject";
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const requests = await listDeleteRequestsForAdmin();
    return NextResponse.json({ requests });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load delete requests.";
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
    const requestId = typeof body.requestId === "string" ? body.requestId : "";
    const action = body.action;

    if (!requestId || (action !== "approve" && action !== "reject")) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const result = await resolveDeleteRequest({ requestId, action });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

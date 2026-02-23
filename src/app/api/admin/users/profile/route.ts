import { NextResponse } from "next/server";
import { adminUpdateUserProfile } from "@/lib/auth-store";
import { requireAdminUser } from "@/lib/auth-session";

type Body = {
  userId?: string;
  name?: string;
  address?: string;
  country?: string;
  state?: string;
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

    const result = await adminUpdateUserProfile({
      userId,
      name: typeof body.name === "string" ? body.name : "",
      address: typeof body.address === "string" ? body.address : "",
      country: typeof body.country === "string" ? body.country : "",
      state: typeof body.state === "string" ? body.state : "",
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update user profile.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

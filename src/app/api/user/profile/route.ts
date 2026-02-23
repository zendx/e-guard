import { NextResponse } from "next/server";
import { getUserProfile, updateOwnProfile } from "@/lib/auth-store";
import { requireSessionUser } from "@/lib/auth-session";

type Body = {
  name?: string;
  address?: string;
  country?: string;
  state?: string;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await requireSessionUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const user = await getUserProfile(auth.user.id);
    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load profile.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireSessionUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as Body;

    const result = await updateOwnProfile({
      userId: auth.user.id,
      name: typeof body.name === "string" ? body.name : "",
      address: typeof body.address === "string" ? body.address : "",
      country: typeof body.country === "string" ? body.country : "",
      state: typeof body.state === "string" ? body.state : "",
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, user: result.user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update profile.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

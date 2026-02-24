import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserBySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth-store";
import DeleteAccountPageClient from "@/components/DeleteAccountPageClient";

export const dynamic = "force-dynamic";

export default async function DeleteAccountPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? "";
  const user = await getUserBySessionToken(token);

  if (!user) {
    redirect("/auth?mode=login");
  }

  return <DeleteAccountPageClient userEmail={user.email} />;
}

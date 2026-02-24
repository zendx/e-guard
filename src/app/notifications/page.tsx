import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserBySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth-store";
import NotificationsPageClient from "@/components/NotificationsPageClient";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? "";
  const user = await getUserBySessionToken(token);

  if (!user) {
    redirect("/auth?mode=login");
  }

  return <NotificationsPageClient userName={user.name} />;
}

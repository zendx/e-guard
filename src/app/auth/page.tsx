import AuthPageClient from "@/components/AuthPageClient";
import { getUserBySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth-store";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AuthPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? "";
  const user = await getUserBySessionToken(token);

  if (user) {
    redirect("/dashboard");
  }

  return <AuthPageClient />;
}

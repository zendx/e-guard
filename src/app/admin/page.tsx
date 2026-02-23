import AdminPanel from "@/components/AdminPanel";
import { getSessionUser } from "@/lib/auth-session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/auth?mode=login");
  }

  if (user.isAdmin !== true) {
    redirect("/dashboard");
  }

  return <AdminPanel />;
}

import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-session";

export default async function AdminHome() {
  const session = await getServerSession({ disableCookieCache: true });
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin");
  if (role !== "admin") redirect("/projects");

  redirect("/admin/grants");
}



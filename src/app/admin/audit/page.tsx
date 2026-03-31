import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import AdminAuditLogClient from "@/components/AdminAuditLogClient";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function AdminAuditPage() {
  const session = await getServerSession({ disableCookieCache: true });
  const role = (session?.user as { role?: unknown } | undefined)?.role;

  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/audit");
  if (role !== "admin") redirect("/projects");

  return (
    <AppShell title="Audit log">
      <AdminAuditLogClient />
    </AppShell>
  );
}

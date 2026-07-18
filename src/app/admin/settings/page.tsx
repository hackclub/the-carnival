import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import AdminSettingsClient from "@/components/AdminSettingsClient";
import { getAllSiteSettings } from "@/lib/site-settings";
import { getServerSession } from "@/lib/server-session";

export default async function AdminSettingsPage() {
  const session = await getServerSession({ disableCookieCache: true });
  const currentUserId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: unknown } | undefined)?.role;

  if (!currentUserId) redirect("/login?callbackUrl=/admin/settings");
  if (role !== "admin") redirect("/projects");

  const settings = await getAllSiteSettings();

  return (
    <AppShell title="Site settings">
      <AdminSettingsClient initial={settings} />
    </AppShell>
  );
}

import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import AdminAnnouncementsClient from "@/components/AdminAnnouncementsClient";
import { getAllAnnouncements } from "@/lib/announcements";
import { getServerSession } from "@/lib/server-session";

export default async function AdminAnnouncementsPage() {
  const session = await getServerSession({ disableCookieCache: true });
  const currentUserId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: unknown } | undefined)?.role;

  if (!currentUserId) redirect("/login?callbackUrl=/admin/announcements");
  if (role !== "admin") redirect("/projects");

  const announcements = await getAllAnnouncements();

  return (
    <AppShell title="Announcements">
      <AdminAnnouncementsClient initial={announcements} />
    </AppShell>
  );
}

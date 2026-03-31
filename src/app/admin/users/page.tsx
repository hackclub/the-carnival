import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import AdminUsersClient, { type UserListItem } from "@/components/AdminUsersClient";
import { db } from "@/db";
import { user } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

export default async function AdminUsersPage() {
  const session = await getServerSession({ disableCookieCache: true });
  const currentUserId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: unknown } | undefined)?.role;

  if (!currentUserId) redirect("/login?callbackUrl=/admin/users");
  if (role !== "admin") redirect("/projects");

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      slackId: user.slackId,
      verificationStatus: user.verificationStatus,
      hackatimeUserId: user.hackatimeUserId,
      role: user.role,
      isFrozen: user.isFrozen,
      frozenReason: user.frozenReason,
      frozenAt: user.frozenAt,
    })
    .from(user)
    .orderBy(asc(user.name));

  const users: UserListItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    slackId: r.slackId,
    verificationStatus: r.verificationStatus,
    hackatimeUserId: r.hackatimeUserId,
    role: r.role,
    isFrozen: !!r.isFrozen,
    frozenReason: r.frozenReason,
    frozenAt: r.frozenAt ? r.frozenAt.toISOString() : null,
  }));

  return (
    <AppShell title="Users">
      <AdminUsersClient initial={users} currentUserId={currentUserId} />
    </AppShell>
  );
}

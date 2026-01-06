import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import { db } from "@/db";
import { user } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

export default async function AdminUsersPage() {
  const session = await getServerSession({ disableCookieCache: true });
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/users");
  if (role !== "admin") redirect("/projects");

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      slackId: user.slackId,
      verificationStatus: user.verificationStatus,
      role: user.role,
    })
    .from(user)
    .orderBy(asc(user.name));

  return (
    <AppShell title="Users">
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
          <div className="col-span-3">Name</div>
          <div className="col-span-3">Email</div>
          <div className="col-span-2">Slack</div>
          <div className="col-span-2">Verification</div>
          <div className="col-span-2">Role</div>
        </div>
        <div className="divide-y divide-border">
          {rows.map((u) => (
            <div key={u.id} className="grid grid-cols-12 gap-3 px-5 py-4">
              <div className="col-span-3 text-foreground font-semibold truncate">{u.name}</div>
              <div className="col-span-3 text-muted-foreground font-mono truncate">{u.email}</div>
              <div className="col-span-2 text-muted-foreground font-mono truncate">{u.slackId || "—"}</div>
              <div className="col-span-2 text-muted-foreground font-mono truncate">
                {u.verificationStatus || "—"}
              </div>
              <div className="col-span-2 text-muted-foreground font-mono truncate">{u.role}</div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}



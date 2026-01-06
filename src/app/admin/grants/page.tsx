import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, inArray } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import { db } from "@/db";
import { project } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

export default async function AdminGrantsPage() {
  const session = await getServerSession({ disableCookieCache: true });
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/grants");
  if (role !== "admin") redirect("/projects");

  const rows = await db
    .select({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      createdAt: project.createdAt,
    })
    .from(project)
    .where(inArray(project.status, ["shipped", "granted"]))
    .orderBy(desc(project.createdAt));

  return (
    <AppShell title="Grants">
      {rows.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8">
          <div className="text-foreground font-semibold text-lg">No shipped projects</div>
          <div className="text-muted-foreground mt-1">
            Approved projects show up here so you can grant them.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {rows.map((p) => (
            <Link
              key={p.id}
              href={`/admin/grants/${p.id}`}
              className="bg-card border border-border rounded-2xl p-6 card-glow transition-all hover:bg-muted block"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-foreground font-bold text-xl truncate">{p.name}</div>
                  <div className="text-muted-foreground mt-2 overflow-hidden">{p.description}</div>
                </div>
                <ProjectStatusBadge status={p.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}



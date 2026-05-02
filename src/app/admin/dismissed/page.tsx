import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import { db } from "@/db";
import { project, user } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function AdminDismissedProjectsPage() {
  const session = await getServerSession({ disableCookieCache: true });
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/dismissed");
  if (role !== "admin") redirect("/projects");

  const rows = await db
    .select({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      resubmissionBlockedAt: project.resubmissionBlockedAt,
      resubmissionBlockedBy: project.resubmissionBlockedBy,
      submittedAt: project.submittedAt,
      createdAt: project.createdAt,
      creatorName: user.name,
      creatorEmail: user.email,
    })
    .from(project)
    .leftJoin(user, eq(project.creatorId, user.id))
    .where(eq(project.resubmissionBlocked, true))
    .orderBy(desc(project.resubmissionBlockedAt));

  return (
    <AppShell title="Dismissed projects">
      <div className="mb-6 text-sm text-muted-foreground">
        Projects that have been rejected and dismissed. Dismissed projects cannot be resubmitted by
        their creator. Open a project to re-enable resubmission.{" "}
        <span className="text-foreground font-semibold">({rows.length})</span>
      </div>

      {rows.length === 0 ? (
        <div className="bg-card border border-border rounded-[var(--radius-2xl)] p-8">
          <div className="text-foreground font-semibold text-lg">No dismissed projects</div>
          <div className="text-muted-foreground mt-1">
            When admins use &ldquo;Reject and dismiss&rdquo; in the review queue, those projects
            show up here so you can re-enable resubmission.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {rows.map((p) => (
            <Link
              key={p.id}
              href={`/admin/dismissed/${p.id}`}
              className="bg-card border border-border rounded-[var(--radius-2xl)] p-6 card-glow transition-all hover:bg-muted block h-full min-h-[240px]"
            >
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-foreground font-bold text-xl truncate">{p.name}</div>
                    <div className="text-muted-foreground mt-2 text-sm">
                      by{" "}
                      <span className="text-foreground font-medium">
                        {p.creatorName || "Unknown creator"}
                      </span>
                      {p.creatorEmail ? (
                        <span className="text-muted-foreground"> &middot; {p.creatorEmail}</span>
                      ) : null}
                    </div>
                    <div className="text-muted-foreground mt-3 line-clamp-3 leading-6">
                      {p.description}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <ProjectStatusBadge status={p.status} />
                  </div>
                </div>

                <div className="mt-auto pt-4 text-xs text-muted-foreground">
                  Dismissed:{" "}
                  {p.resubmissionBlockedAt
                    ? p.resubmissionBlockedAt.toLocaleString()
                    : "—"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}

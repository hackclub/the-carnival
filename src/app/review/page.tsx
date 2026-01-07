import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import ProjectEditorBadge from "@/components/ProjectEditorBadge";
import { db } from "@/db";
import { project, user, type UserRole } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

function canReview(role: unknown): role is Extract<UserRole, "reviewer" | "admin"> {
  return role === "reviewer" || role === "admin";
}

export default async function ReviewQueuePage() {
  const session = await getServerSession({ disableCookieCache: true });
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/review");
  }

  const role = (session.user as { role?: unknown } | undefined)?.role;
  if (!canReview(role)) {
    redirect("/projects");
  }

  const rows = await db
    .select({
      id: project.id,
      name: project.name,
      description: project.description,
      editor: project.editor,
      editorOther: project.editorOther,
      status: project.status,
      createdAt: project.createdAt,
      creatorName: user.name,
    })
    .from(project)
    .leftJoin(user, eq(project.creatorId, user.id))
    .where(eq(project.status, "in-review"))
    .orderBy(desc(project.createdAt));

  return (
    <AppShell title="Review queue">
      {rows.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8">
          <div className="text-foreground font-semibold text-lg">No projects in review</div>
          <div className="text-muted-foreground mt-1">
            Projects show up here when creators submit them for review.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {rows.map((p) => (
            <Link
              key={p.id}
              href={`/review/${p.id}`}
              className="bg-card border border-border rounded-2xl p-6 card-glow transition-all hover:bg-muted block"
              aria-label={`Review ${p.name}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-foreground font-bold text-xl truncate">{p.name}</div>
                  <div className="text-muted-foreground text-sm mt-1 truncate">
                    by {p.creatorName || "Unknown creator"}
                  </div>
                  <div className="text-muted-foreground mt-3 overflow-hidden">{p.description}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <ProjectEditorBadge editor={p.editor} editorOther={p.editorOther} />
                  <ProjectStatusBadge status={p.status} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}



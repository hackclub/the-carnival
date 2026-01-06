import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getServerSession } from "@/lib/server-session";
import Link from "next/link";
import { desc, inArray, eq } from "drizzle-orm";
import { db } from "@/db";
import { project, user } from "@/db/schema";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";

export default async function ExplorePage() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/explore");
  }

  const projects = await db
    .select({
      id: project.id,
      name: project.name,
      description: project.description,
      playableUrl: project.playableUrl,
      codeUrl: project.codeUrl,
      status: project.status,
      createdAt: project.createdAt,
      creatorName: user.name,
    })
    .from(project)
    .leftJoin(user, eq(project.creatorId, user.id))
    .where(inArray(project.status, ["shipped", "granted"]))
    .orderBy(desc(project.createdAt));

  return (
    <AppShell title="Explore">
      {projects.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8">
          <div className="text-foreground font-semibold text-lg">No shipped projects yet</div>
          <div className="text-muted-foreground mt-1">
            Once projects are approved, they’ll show up here.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {projects.map((p) => (
            <div
              key={p.id}
              className="bg-card border border-border rounded-2xl p-6 card-glow transition-all hover:bg-muted"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-foreground font-bold text-xl truncate">{p.name}</div>
                  <div className="text-muted-foreground text-sm mt-1 truncate">
                    by {p.creatorName || "Unknown creator"}
                  </div>
                  <div className="text-muted-foreground mt-3 overflow-hidden">{p.description}</div>
                </div>
                <ProjectStatusBadge status={p.status} />
              </div>

              <div className="mt-6 flex items-center gap-3">
                <Link
                  href={p.playableUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 text-foreground px-4 py-2 rounded-full font-semibold transition-colors border border-border text-sm"
                >
                  Play
                </Link>
                <Link
                  href={p.codeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 text-foreground px-4 py-2 rounded-full font-semibold transition-colors border border-border text-sm"
                >
                  Code
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}



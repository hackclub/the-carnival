import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import CreateProjectModal from "@/components/CreateProjectModal";
import ProjectEditorBadge from "@/components/ProjectEditorBadge";
import { db } from "@/db";
import { project } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";
import { fetchHackatimeProjectHoursByName } from "@/lib/hackatime";

function formatHoursMinutes(hours: number, minutes: number) {
  const h = Number.isFinite(hours) ? Math.max(0, Math.floor(hours)) : 0;
  const m = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;
  return `${h}h${String(m).padStart(2, "0")}m`;
}

export default async function ProjectsPage() {
  const session = await getServerSession({ disableCookieCache: true });
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/projects");
  }

  const hoursByName = await fetchHackatimeProjectHoursByName(session.user.id);

  const myProjects = await db
    .select({
      id: project.id,
      name: project.name,
      description: project.description,
      editor: project.editor,
      editorOther: project.editorOther,
      hackatimeProjectName: project.hackatimeProjectName,
      status: project.status,
      createdAt: project.createdAt,
    })
    .from(project)
    .where(eq(project.creatorId, session.user.id))
    .orderBy(desc(project.createdAt));

  return (
    <AppShell title="My projects">
      {myProjects.length === 0 ? (
        <div className="platform-surface-card p-8">
          <div className="text-foreground font-semibold text-lg">No projects yet</div>
          <div className="text-muted-foreground mt-1">
            Create your first project to start tracking hours and status.
          </div>
          <div className="mt-6">
            <Link
              href="/projects?new=1"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--carnival-squircle-radius)] border-2 border-[var(--carnival-border)] bg-[var(--platform-accent)] px-6 py-3 text-sm font-black tracking-[0.02em] text-[#fff7dc] transition-colors hover:bg-[#ee9817]"
            >
              Create a project
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {myProjects.map((p) => {
            const hm =
              hoursByName[p.hackatimeProjectName] ??
              hoursByName[p.name] ??
              { hours: 0, minutes: 0 };

            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="platform-surface-card p-6 card-glow transition-all hover:bg-muted block"
                aria-label={`Manage ${p.name}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-foreground font-bold text-xl truncate">
                      {p.name}
                    </div>
                    <div className="text-muted-foreground mt-2 overflow-hidden">
                      {p.description}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <ProjectEditorBadge editor={p.editor} editorOther={p.editorOther} />
                    <ProjectStatusBadge status={p.status} />
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Hours</div>
                  <div className="text-foreground font-semibold">
                    {formatHoursMinutes(hm.hours, hm.minutes)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* FAB */}
      <Link
        href="/projects?new=1"
        className="fixed right-6 bottom-6 flex h-14 w-14 items-center justify-center rounded-[var(--carnival-squircle-radius)] border-2 border-[var(--carnival-border)] bg-[var(--platform-accent)] text-[#fff7dc] transition-colors hover:bg-[#ee9817]"
        aria-label="Create new project"
        title="Create new project"
      >
        <span className="text-3xl leading-none">+</span>
      </Link>

      <CreateProjectModal />
    </AppShell>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import CreateProjectModal from "@/components/CreateProjectModal";
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

  const hackatimeUserId = (() => {
    const maybe = session.user as unknown as { slackId?: unknown };
    return typeof maybe.slackId === "string" ? maybe.slackId : undefined;
  })();
  const hoursByName = hackatimeUserId
    ? await fetchHackatimeProjectHoursByName(hackatimeUserId)
    : {};

  const myProjects = await db
    .select({
      id: project.id,
      name: project.name,
      description: project.description,
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
        <div className="bg-carnival-card/70 border border-white/10 rounded-2xl p-8">
          <div className="text-white font-semibold text-lg">No projects yet</div>
          <div className="text-gray-400 mt-1">
            Create your first project to start tracking hours and status.
          </div>
          <div className="mt-6">
            <Link
              href="/projects?new=1"
              className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 text-white px-6 py-3 rounded-full font-bold transition-colors"
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
              <div
                key={p.id}
                className="bg-carnival-card/80 backdrop-blur border border-white/10 rounded-2xl p-6 card-glow transition-all hover:bg-carnival-card"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-white font-bold text-xl truncate">
                      {p.name}
                    </div>
                    <div className="text-gray-400 mt-2 overflow-hidden">
                      {p.description}
                    </div>
                  </div>
                  <ProjectStatusBadge status={p.status} />
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-gray-400">Hours</div>
                  <div className="text-white font-semibold">
                    {formatHoursMinutes(hm.hours, hm.minutes)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FAB */}
      <Link
        href="/projects?new=1"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-carnival-red hover:bg-carnival-red/80 text-white flex items-center justify-center shadow-xl border border-white/10 carnival-glow transition-all hover:scale-105"
        aria-label="Create new project"
        title="Create new project"
      >
        <span className="text-3xl leading-none">+</span>
      </Link>

      <CreateProjectModal />
    </AppShell>
  );
}



import Link from "next/link";
import Image from "next/image";
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
      <section className="carnival-panel relative mb-8 overflow-hidden px-5 py-6 sm:px-7 sm:py-8">
        <Image
          src="/ferris-wheel.png"
          alt=""
          width={516}
          height={525}
          className="pointer-events-none absolute -right-6 -top-8 h-auto w-24 rotate-[8deg] opacity-45 sm:w-36 sm:opacity-75"
        />
        <Image
          src="/tent.png"
          alt=""
          width={674}
          height={440}
          className="pointer-events-none absolute -bottom-10 -left-10 h-auto w-28 -rotate-[6deg] opacity-40 sm:w-44 sm:opacity-65"
        />
        <div className="relative z-10 max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8f4a18]">
            Project Midway
          </p>
          <h2 className="mt-2 text-2xl font-black uppercase tracking-[0.06em] text-[#5b1f0a] [text-wrap:balance] sm:text-3xl">
            Track every build from first commit to final review.
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#6d3510] sm:text-base">
            Keep your projects tidy, review-ready, and synced with your hours.
          </p>
        </div>
      </section>

      {myProjects.length === 0 ? (
        <div className="carnival-card carnival-card-soft p-8 sm:p-10">
          <div className="text-foreground font-semibold text-lg">No projects yet</div>
          <div className="text-muted-foreground mt-1">
            Create your first project to start tracking hours and status.
          </div>
          <div className="mt-6">
            <Link
              href="/projects?new=1"
              className="inline-flex items-center justify-center rounded-full border-[3px] border-[#74210a] bg-[#f6a61c] px-6 py-3 font-black uppercase tracking-[0.06em] text-[#fff7dc] shadow-[0_5px_0_#bf6216] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_0_#bf6216] active:scale-[0.96]"
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
                className="carnival-card carnival-card-soft block p-6 transition-transform duration-200 hover:-translate-y-1"
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
                  <div className="text-foreground font-semibold tabular-nums">
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
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-[#74210a] bg-[#f6a61c] text-[#fff7dc] shadow-[0_5px_0_#bf6216,0_14px_26px_rgba(120,53,15,0.28)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_0_#bf6216,0_20px_30px_rgba(120,53,15,0.32)] active:scale-[0.96]"
        aria-label="Create new project"
        title="Create new project"
      >
        <span className="text-3xl leading-none">+</span>
      </Link>

      <CreateProjectModal />
    </AppShell>
  );
}

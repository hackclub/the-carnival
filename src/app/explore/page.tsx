import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getServerSession } from "@/lib/server-session";
import { slack } from "@/lib/slack";
import Link from "next/link";
import { desc, inArray, eq } from "drizzle-orm";
import { db } from "@/db";
import { project, user } from "@/db/schema";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import ProjectEditorBadge from "@/components/ProjectEditorBadge";

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
      editor: project.editor,
      editorOther: project.editorOther,
      videoUrl: project.videoUrl,
      playableDemoUrl: project.playableDemoUrl,
      codeUrl: project.codeUrl,
      screenshots: project.screenshots,
      status: project.status,
      createdAt: project.createdAt,
      creatorSlackId: user.slackId,
    })
    .from(project)
    .leftJoin(user, eq(project.creatorId, user.id))
    .where(inArray(project.status, ["shipped", "granted"]))
    .orderBy(desc(project.createdAt));

  const slackIds = Array.from(
    new Set(projects.map((p) => p.creatorSlackId).filter((id): id is string => !!id)),
  );
  const slackNameById = new Map<string, string>();
  if (slack) {
    if (slackIds.length) {
      // Assign slack to a non-null variable so TypeScript knows it's not null in the map callback
      const slackClient = slack;
      const lookups = await Promise.allSettled(
        slackIds.map(async (id) => {
          const info = await slackClient.users.info({ user: id });
          const userInfo = (info as { user?: { name?: string; profile?: { display_name?: string } } })
            .user;
          const displayName = userInfo?.profile?.display_name?.trim();
          const name = userInfo?.name?.trim();
          const label = displayName || name || id;
          slackNameById.set(id, label);
        }),
      );
      if (lookups.some((r) => r.status === "rejected")) {
        console.warn("Failed to fetch some Slack usernames for Explore.");
      }
    }
  } else if (slackIds.length) {
    // Fallback: just use the Slack ID as the label if slack is not available
    slackIds.forEach((id) => {
      slackNameById.set(id, id);
    });
  }

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
          {projects.map((p) => {
            const firstScreenshot = p.screenshots.find((url) => url.trim().length > 0);

            return (
              <div
                key={p.id}
                className="bg-card border border-border rounded-2xl p-6 card-glow transition-all hover:bg-muted"
              >
                {firstScreenshot ? (
                  <div className="mb-4 overflow-hidden rounded-xl border border-border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={firstScreenshot}
                      alt={`${p.name} screenshot`}
                      className="h-40 w-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="mb-4 flex h-40 w-full items-center justify-center rounded-xl border border-border bg-muted text-sm text-muted-foreground">
                    No screenshot
                  </div>
                )}

                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-foreground font-bold text-xl truncate">{p.name}</div>
                    <div className="text-muted-foreground text-sm mt-1 truncate">
                      by
                      {p.creatorSlackId && slackNameById.get(p.creatorSlackId)
                        ? ` @${slackNameById.get(p.creatorSlackId)}`
                        : " Unknown creator"}
                    </div>
                    <div className="text-muted-foreground mt-3 overflow-hidden">{p.description}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <ProjectEditorBadge editor={p.editor} editorOther={p.editorOther} />
                    <ProjectStatusBadge status={p.status} />
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-3">
                  {p.playableDemoUrl || p.videoUrl ? (
                    <Link
                      href={p.playableDemoUrl || p.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 text-foreground px-4 py-2 rounded-full font-semibold transition-colors border border-border text-sm"
                    >
                      Play
                    </Link>
                  ) : null}
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
            );
          })}
        </div>
      )}
    </AppShell>
  );
}


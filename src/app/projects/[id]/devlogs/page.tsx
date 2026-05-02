import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import { Badge, Button, Card, CardContent } from "@/components/ui";
import { db } from "@/db";
import { devlog, project, user } from "@/db/schema";
import { formatDurationHM } from "@/lib/devlog-shared";
import { getServerSession } from "@/lib/server-session";

function canView(role: unknown, isCreator: boolean) {
  if (isCreator) return true;
  return role === "reviewer" || role === "admin";
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ProjectDevlogListPage(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession({ disableCookieCache: true });
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/projects`);
  }

  const { id } = await props.params;
  const role = (session.user as { role?: unknown } | undefined)?.role;

  const projectRows = await db
    .select({
      id: project.id,
      name: project.name,
      creatorId: project.creatorId,
      status: project.status,
      submittedAt: project.submittedAt,
      hoursSpentSeconds: project.hoursSpentSeconds,
      startedOnCarnivalAt: project.startedOnCarnivalAt,
      createdAt: project.createdAt,
    })
    .from(project)
    .where(eq(project.id, id))
    .limit(1);

  const p = projectRows[0];
  if (!p) notFound();

  const isCreator = p.creatorId === session.user.id;
  if (!canView(role, isCreator)) {
    notFound();
  }

  const devlogRows = await db
    .select({
      id: devlog.id,
      title: devlog.title,
      content: devlog.content,
      startedAt: devlog.startedAt,
      endedAt: devlog.endedAt,
      durationSeconds: devlog.durationSeconds,
      attachments: devlog.attachments,
      usedAi: devlog.usedAi,
      createdAt: devlog.createdAt,
      userId: devlog.userId,
      authorName: user.name,
    })
    .from(devlog)
    .leftJoin(user, eq(devlog.userId, user.id))
    .where(and(eq(devlog.projectId, id)))
    .orderBy(desc(devlog.endedAt), asc(devlog.id));

  const canWrite = isCreator && p.status === "work-in-progress" && !p.submittedAt;
  const totalHours = formatDurationHM(p.hoursSpentSeconds ?? 0);

  return (
    <AppShell title={`Devlogs — ${p.name}`}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/projects/${p.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to project
        </Link>
        {canWrite ? (
          <Link href={`/projects/${p.id}/devlogs/new`}>
            <Button variant="primary">Write devlog</Button>
          </Link>
        ) : null}
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">{p.name} · devlogs</h1>
            <Badge>{devlogRows.length}</Badge>
            <Badge variant="info">{totalHours.label} logged</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Full devlog history for this project. Each devlog captures the hours you logged in
            Hackatime for the window you selected.
          </p>
        </CardContent>
      </Card>

      {devlogRows.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="rounded-[var(--radius-xl)] border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              No devlogs yet.
            </div>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {devlogRows.map((row) => {
            const duration = formatDurationHM(row.durationSeconds);
            const excerpt =
              (row.content ?? "").length > 400
                ? `${row.content.slice(0, 400).trimEnd()}…`
                : row.content;
            return (
              <li key={row.id}>
                <Link
                  href={`/projects/${p.id}/devlogs/${row.id}`}
                  className="block rounded-[var(--radius-2xl)] border border-border bg-card px-5 py-4 transition-colors hover:bg-muted"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-foreground">{row.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{row.authorName || "Unknown"}</span>
                        <span>·</span>
                        <span>
                          {formatDateTime(row.startedAt.toISOString())} →{" "}
                          {formatDateTime(row.endedAt.toISOString())}
                        </span>
                        <span>·</span>
                        <span className="font-semibold text-foreground">{duration.label}</span>
                        {row.usedAi ? (
                          <>
                            <span>·</span>
                            <span className="rounded-full bg-amber-500/15 text-amber-200 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                              AI
                            </span>
                          </>
                        ) : null}
                      </div>
                      {excerpt ? (
                        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{excerpt}</p>
                      ) : null}
                    </div>
                    {row.attachments && row.attachments.length > 0 ? (
                      <div className="flex -space-x-2 shrink-0">
                        {row.attachments.slice(0, 4).map((url, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={`${row.id}-att-${i}`}
                            src={url}
                            alt=""
                            className="h-14 w-14 rounded-lg border-2 border-background object-cover bg-muted"
                            referrerPolicy="no-referrer"
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import { Badge, Button, Card, CardContent } from "@/components/ui";
import { db } from "@/db";
import { devlog, project, user } from "@/db/schema";
import { formatDurationHM } from "@/lib/devlog-shared";
import { listProjectHackatimeProjects, reviewableDevlogWhere } from "@/lib/devlogs";
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

function formatDateOnly(date: Date | null) {
  if (!date) return null;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type BreakdownRow = {
  key: string;
  name: string;
  seconds: number;
  isLinked: boolean;
  isDefault: boolean;
  devlogCount: number;
};

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
      hackatimeStartedAt: project.hackatimeStartedAt,
      hackatimeStoppedAt: project.hackatimeStoppedAt,
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

  const linkedHackatimeProjects = await listProjectHackatimeProjects(id);

  const rangeStart = p.hackatimeStartedAt;
  const rangeEnd = p.hackatimeStoppedAt;
  const inRangeDevlogs = await db
    .select({
      durationSeconds: devlog.durationSeconds,
      hackatimeProjectNameSnapshot: devlog.hackatimeProjectNameSnapshot,
    })
    .from(devlog)
    .where(reviewableDevlogWhere(id, { start: rangeStart, end: rangeEnd }));

  const linkedByLowerName = new Map(
    linkedHackatimeProjects.map((l) => [l.name.toLowerCase(), l] as const),
  );
  const breakdownByKey = new Map<string, BreakdownRow>();

  for (const linked of linkedHackatimeProjects) {
    const key = linked.name.toLowerCase();
    breakdownByKey.set(key, {
      key,
      name: linked.name,
      seconds: 0,
      isLinked: true,
      isDefault: linked.isDefault,
      devlogCount: 0,
    });
  }

  for (const row of inRangeDevlogs) {
    const rawName = (row.hackatimeProjectNameSnapshot ?? "").trim();
    const displayName = rawName || "Unspecified";
    const lookupKey = rawName ? rawName.toLowerCase() : "__unspecified__";
    const seconds = Math.max(0, Math.floor(row.durationSeconds || 0));

    const existing = breakdownByKey.get(lookupKey);
    if (existing) {
      existing.seconds += seconds;
      existing.devlogCount += 1;
      continue;
    }

    breakdownByKey.set(lookupKey, {
      key: lookupKey,
      name: displayName,
      seconds,
      isLinked: linkedByLowerName.has(lookupKey),
      isDefault: false,
      devlogCount: 1,
    });
  }

  const breakdownRows = Array.from(breakdownByKey.values()).sort((a, b) => {
    if (b.seconds !== a.seconds) return b.seconds - a.seconds;
    return a.name.localeCompare(b.name);
  });

  const breakdownTotalSeconds = breakdownRows.reduce((acc, row) => acc + row.seconds, 0);
  const hasRange =
    rangeStart instanceof Date &&
    rangeEnd instanceof Date &&
    !Number.isNaN(rangeStart.getTime()) &&
    !Number.isNaN(rangeEnd.getTime()) &&
    rangeStart.getTime() <= rangeEnd.getTime();
  const rangeLabel = hasRange
    ? `${formatDateOnly(rangeStart)} → ${formatDateOnly(rangeEnd)}`
    : "All time (no review range set)";

  const canWrite = isCreator && p.status === "work-in-progress";
  const totalHours = formatDurationHM(p.hoursSpentSeconds ?? 0);
  const inRangeLabel = formatDurationHM(breakdownTotalSeconds);

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

      <Card className="mb-6">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-foreground">Hackatime project contributions</div>
              <p className="mt-1 text-xs text-muted-foreground">
                How each linked Hackatime project contributes to the considered range.
              </p>
            </div>
            <div className="text-xs text-muted-foreground text-right">
              <div>Range: {rangeLabel}</div>
              <div className="mt-0.5 font-semibold text-foreground">
                Total: {inRangeLabel.label}
              </div>
            </div>
          </div>

          {breakdownRows.length === 0 ? (
            <div className="rounded-[var(--radius-xl)] border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              {linkedHackatimeProjects.length === 0
                ? "No Hackatime projects linked yet. Add some on the project page."
                : "No devlogs counted in the considered range yet."}
            </div>
          ) : (
            <ul className="space-y-2">
              {breakdownRows.map((row) => {
                const percent =
                  breakdownTotalSeconds > 0
                    ? Math.round((row.seconds / breakdownTotalSeconds) * 1000) / 10
                    : 0;
                const hm = formatDurationHM(row.seconds);
                return (
                  <li
                    key={row.key}
                    className="rounded-[var(--radius-xl)] border border-border bg-background px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <code className="text-sm text-foreground truncate">{row.name}</code>
                        {row.isDefault ? (
                          <span className="rounded-full border border-carnival-blue/30 bg-carnival-blue/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-carnival-blue">
                            default
                          </span>
                        ) : null}
                        {!row.isLinked ? (
                          <span
                            className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200"
                            title="Devlogs reference this Hackatime project but it isn't linked."
                          >
                            not linked
                          </span>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {row.devlogCount} devlog{row.devlogCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{hm.label}</span>
                        <span>{percent.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div
                      className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                      aria-hidden="true"
                    >
                      <div
                        className={`h-full ${row.isLinked ? "bg-carnival-blue" : "bg-amber-500/70"}`}
                        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
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
                  className="block platform-surface-card px-5 py-4 transition-colors hover:bg-muted"
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

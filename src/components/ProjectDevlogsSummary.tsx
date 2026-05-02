import Link from "next/link";
import { Badge, Button, Card, CardContent } from "@/components/ui";
import { formatDurationHM } from "@/lib/devlog-shared";

export type DevlogSummary = {
  id: string;
  title: string;
  createdAt: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  attachments: string[];
  usedAi: boolean;
  authorName: string;
  excerpt: string;
};

type Props = {
  projectId: string;
  devlogs: DevlogSummary[];
  totalCount: number;
  canWrite: boolean;
  writeBlockedReason?: string | null;
  projectStartedAtIso: string | null;
  submittedAtIso: string | null;
  totalHoursSeconds: number;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function ProjectDevlogsSummary({
  projectId,
  devlogs,
  totalCount,
  canWrite,
  writeBlockedReason,
  projectStartedAtIso,
  submittedAtIso,
  totalHoursSeconds,
}: Props) {
  const remaining = Math.max(0, totalCount - devlogs.length);
  const totalFormatted = formatDurationHM(totalHoursSeconds);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Devlogs</h2>
              <Badge>{totalCount}</Badge>
              <Badge variant="info">{totalFormatted.label} logged</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Share detailed progress updates. Reviewers use devlogs to verify how
              you spent your hours between{" "}
              {projectStartedAtIso ? (
                <strong className="text-foreground">{formatDate(projectStartedAtIso)}</strong>
              ) : (
                "project start"
              )}
              {" "}and{" "}
              {submittedAtIso ? (
                <strong className="text-foreground">{formatDate(submittedAtIso)}</strong>
              ) : (
                "submission"
              )}
              .
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/projects/${projectId}/devlogs`}>
              <Button variant="outline">View all</Button>
            </Link>
            {canWrite ? (
              <Link href={`/projects/${projectId}/devlogs/new`}>
                <Button variant="primary">Write devlog</Button>
              </Link>
            ) : (
              <Button variant="primary" disabled title={writeBlockedReason ?? undefined}>
                Write devlog
              </Button>
            )}
          </div>
        </div>

        {!canWrite && writeBlockedReason ? (
          <div className="mt-3 text-xs text-muted-foreground">{writeBlockedReason}</div>
        ) : null}

        {devlogs.length === 0 ? (
          <div className="mt-5 rounded-[var(--radius-xl)] border border-dashed border-border bg-muted/30 px-4 py-5 text-sm text-muted-foreground">
            {canWrite
              ? "You haven't written any devlogs yet. Devlogs log your hours; reviewers use them to verify your time."
              : "No devlogs yet."}
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {devlogs.map((d) => {
              const duration = formatDurationHM(d.durationSeconds);
              return (
                <li key={d.id}>
                  <Link
                    href={`/projects/${projectId}/devlogs/${d.id}`}
                    className="block rounded-[var(--radius-xl)] border border-border bg-background/60 px-4 py-3 transition-colors hover:bg-muted"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-foreground">
                          {d.title}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{d.authorName}</span>
                          <span>·</span>
                          <span>{formatDate(d.endedAt)}</span>
                          <span>·</span>
                          <span className="font-semibold text-foreground">{duration.label}</span>
                          {d.usedAi ? (
                            <>
                              <span>·</span>
                              <span className="rounded-full bg-amber-500/15 text-amber-200 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                                AI
                              </span>
                            </>
                          ) : null}
                        </div>
                        {d.excerpt ? (
                          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                            {d.excerpt}
                          </p>
                        ) : null}
                      </div>
                      {d.attachments.length > 0 ? (
                        <div className="flex -space-x-2 shrink-0">
                          {d.attachments.slice(0, 3).map((url, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={`${d.id}-att-${i}`}
                              src={url}
                              alt=""
                              className="h-10 w-10 rounded-lg border-2 border-background object-cover bg-muted"
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
            {remaining > 0 ? (
              <li>
                <Link
                  href={`/projects/${projectId}/devlogs`}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  View {remaining} more devlog{remaining === 1 ? "" : "s"} →
                </Link>
              </li>
            ) : null}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

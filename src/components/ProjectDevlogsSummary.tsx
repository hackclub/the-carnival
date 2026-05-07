import Link from "next/link";
import { Badge, Button, Card, CardContent } from "@/components/ui";
import { formatDurationHM } from "@/lib/devlog-shared";

export type DevlogSummary = {
  id: string;
  title: string;
  category?: "learning" | "design" | "coding";
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
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const CATEGORY_CONFIG = {
  coding: { label: "Coding", color: "bg-carnival-blue/15 text-carnival-blue", icon: "⌨️" },
  design: { label: "Design", color: "bg-carnival-purple/15 text-carnival-purple", icon: "🎨" },
  learning: { label: "Learning", color: "bg-carnival-green/15 text-carnival-green", icon: "📚" },
} as const;

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
              <h2 className="text-lg font-semibold text-foreground">Journal</h2>
              <Badge>{totalCount}</Badge>
              <Badge variant="info">{totalFormatted.label} logged</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Log your progress. Reviewers verify your hours between{" "}
              {projectStartedAtIso ? (
                <strong className="text-foreground">
                  {formatDate(projectStartedAtIso)}
                </strong>
              ) : (
                "project start"
              )}
              {" "}and{" "}
              {submittedAtIso ? (
                <strong className="text-foreground">
                  {formatDate(submittedAtIso)}
                </strong>
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
                <Button variant="primary">New entry</Button>
              </Link>
            ) : (
              <Button
                variant="primary"
                disabled
                title={writeBlockedReason ?? undefined}
              >
                New entry
              </Button>
            )}
          </div>
        </div>

        {!canWrite && writeBlockedReason ? (
          <div className="mt-3 text-xs text-muted-foreground">
            {writeBlockedReason}
          </div>
        ) : null}

        {devlogs.length === 0 ? (
          <div className="mt-5 rounded-[var(--radius-xl)] border border-dashed border-border bg-muted/30 px-4 py-5 text-sm text-muted-foreground">
            {canWrite
              ? "No journal entries yet. Start logging your progress to track hours."
              : "No entries yet."}
          </div>
        ) : (
          <div className="mt-6 relative">
            {/* Timeline connector line */}
            <div
              className="absolute left-[19px] top-2 bottom-2 w-px bg-border"
              aria-hidden="true"
            />

            <div className="space-y-0">
              {devlogs.map((d, idx) => {
                const duration = formatDurationHM(d.durationSeconds);
                const cat = CATEGORY_CONFIG[d.category ?? "coding"];
                const isLast = idx === devlogs.length - 1 && remaining === 0;

                return (
                  <div key={d.id} className="relative pl-12 pb-6 group">
                    {/* Timeline node */}
                    <div
                      className="absolute left-2.5 top-1 h-[14px] w-[14px] rounded-full border-2 border-border bg-card z-10 group-hover:border-carnival-amber transition-colors"
                      aria-hidden="true"
                    />

                    {/* Date label */}
                    <div className="text-xs text-muted-foreground font-medium mb-1.5">
                      {formatShortDate(d.endedAt)}
                    </div>

                    <Link
                      href={`/projects/${projectId}/devlogs/${d.id}`}
                      className="block rounded-[var(--radius-xl)] border border-border bg-background/60 px-4 py-3 transition-colors hover:bg-muted/60 hover:border-muted-foreground/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground truncate">
                              {d.title}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cat.color}`}
                            >
                              {cat.icon} {cat.label}
                            </span>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{d.authorName}</span>
                            <span className="opacity-40">·</span>
                            <span className="font-semibold text-foreground">
                              {duration.label}
                            </span>
                            {d.usedAi ? (
                              <>
                                <span className="opacity-40">·</span>
                                <span className="rounded-full bg-amber-500/15 text-amber-600 px-1.5 py-0.5 text-[10px] uppercase tracking-wide font-bold">
                                  AI
                                </span>
                              </>
                            ) : null}
                          </div>

                          {d.excerpt ? (
                            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground leading-relaxed">
                              {d.excerpt}
                            </p>
                          ) : null}
                        </div>

                        {d.attachments.length > 0 ? (
                          <div className="flex gap-1.5 shrink-0">
                            {d.attachments.slice(0, 3).map((url, i) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={`${d.id}-att-${i}`}
                                src={url}
                                alt=""
                                className="h-12 w-12 rounded-lg border border-border object-cover bg-muted"
                                referrerPolicy="no-referrer"
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </Link>
                  </div>
                );
              })}

              {remaining > 0 ? (
                <div className="relative pl-12">
                  <div
                    className="absolute left-2.5 top-1 h-[14px] w-[14px] rounded-full border-2 border-dashed border-border bg-card z-10"
                    aria-hidden="true"
                  />
                  <Link
                    href={`/projects/${projectId}/devlogs`}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {remaining} more entr{remaining === 1 ? "y" : "ies"} →
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import Link from "next/link";
import { Badge, Button, Card, CardContent } from "@/components/ui";

export type DevlogSummary = {
  id: string;
  title: string;
  createdAt: string; // ISO
  authorName: string;
  excerpt: string;
};

type Props = {
  projectId: string;
  devlogs: DevlogSummary[];
  totalCount: number;
  canWrite: boolean;
  projectStartedAtIso: string | null;
  submittedAtIso: string | null;
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
  projectStartedAtIso,
  submittedAtIso,
}: Props) {
  const remaining = Math.max(0, totalCount - devlogs.length);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Devlogs</h2>
              <Badge>{totalCount}</Badge>
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
            ) : null}
          </div>
        </div>

        {devlogs.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-sm text-muted-foreground">
            {canWrite
              ? "You haven't written any devlogs yet. Writing devlogs as you build the project helps reviewers approve your hours."
              : "No devlogs yet."}
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {devlogs.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/projects/${projectId}/devlogs/${d.id}`}
                  className="block rounded-xl border border-border bg-background/60 px-4 py-3 transition-colors hover:bg-muted"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-foreground">
                        {d.title}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {d.authorName} · {formatDate(d.createdAt)}
                      </div>
                    </div>
                  </div>
                  {d.excerpt ? (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {d.excerpt}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
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

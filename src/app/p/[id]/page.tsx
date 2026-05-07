import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, lte } from "drizzle-orm";
import { Badge, Card, CardContent } from "@/components/ui";
import { PlatformContent, PlatformShell } from "@/components/ui/platform";
import { db } from "@/db";
import { devlog, project, user } from "@/db/schema";
import { formatDurationHM } from "@/lib/devlog-shared";

function formatDateTime(iso: string | null) {
  if (!iso) return null;
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

function formatDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await props.params;
  const rows = await db
    .select({ name: project.name, description: project.description })
    .from(project)
    .where(eq(project.id, id))
    .limit(1);
  const p = rows[0];
  if (!p) return { title: "Project not found" };
  return {
    title: `${p.name} · Carnival`,
    description: p.description?.slice(0, 200) ?? undefined,
  };
}

export default async function PublicProjectPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const projectRows = await db
    .select({
      id: project.id,
      name: project.name,
      description: project.description,
      tags: project.tags,
      category: project.category,
      videoUrl: project.videoUrl,
      codeUrl: project.codeUrl,
      playableDemoUrl: project.playableDemoUrl,
      previewImage: project.previewImage,
      screenshots: project.screenshots,
      hoursSpentSeconds: project.hoursSpentSeconds,
      hackatimeProjectName: project.hackatimeProjectName,
      status: project.status,
      submittedAt: project.submittedAt,
      startedOnCarnivalAt: project.startedOnCarnivalAt,
      createdAt: project.createdAt,
      creatorId: project.creatorId,
      creatorName: user.name,
      creatorImage: user.image,
    })
    .from(project)
    .leftJoin(user, eq(project.creatorId, user.id))
    .where(eq(project.id, id))
    .limit(1);

  const p = projectRows[0];
  if (!p) notFound();

  // Only show submitted projects publicly. Keeps in-progress drafts private.
  if (!p.submittedAt) notFound();

  const submittedAt = p.submittedAt;
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
      aiUsageDescription: devlog.aiUsageDescription,
      hackatimeProjectNameSnapshot: devlog.hackatimeProjectNameSnapshot,
      createdAt: devlog.createdAt,
      userId: devlog.userId,
      authorName: user.name,
    })
    .from(devlog)
    .leftJoin(user, eq(devlog.userId, user.id))
    .where(and(eq(devlog.projectId, id), lte(devlog.createdAt, submittedAt)))
    .orderBy(asc(devlog.startedAt));

  const totalSeconds = devlogRows.reduce(
    (acc, r) => acc + Math.max(0, r.durationSeconds ?? 0),
    0,
  );
  const totalFormatted = formatDurationHM(totalSeconds);

  return (
    <PlatformShell>
      <PlatformContent className="pt-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Carnival
          </Link>
          <Badge variant="info">Submitted {formatDate(submittedAt.toISOString())}</Badge>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  {p.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {p.creatorName ? <span>by {p.creatorName}</span> : null}
                  {p.creatorName ? <span>·</span> : null}
                  <span className="font-semibold text-foreground">
                    {totalFormatted.label} of work
                  </span>
                  <span>·</span>
                  <span>{devlogRows.length} devlog{devlogRows.length === 1 ? "" : "s"}</span>
                </div>
                {p.tags && p.tags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.tags.map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {p.description ? (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {p.description}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              {p.codeUrl ? (
                <a
                  href={p.codeUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-[var(--carnival-squircle-radius)] border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  Code
                </a>
              ) : null}
              {p.playableDemoUrl ? (
                <a
                  href={p.playableDemoUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-[var(--carnival-squircle-radius)] border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  Playable demo
                </a>
              ) : null}
              {p.videoUrl ? (
                <a
                  href={p.videoUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-[var(--carnival-squircle-radius)] border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  Demo video
                </a>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold text-foreground">Devlog timeline</h2>
          <Badge>{devlogRows.length}</Badge>
          <Badge variant="info">{totalFormatted.label} total</Badge>
        </div>

        {devlogRows.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="rounded-[var(--radius-xl)] border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                No devlogs were posted before this project was submitted.
              </div>
            </CardContent>
          </Card>
        ) : (
          <ol className="space-y-4">
            {devlogRows.map((row, i) => {
              const duration = formatDurationHM(row.durationSeconds);
              return (
                <li key={row.id}>
                  <Card>
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Devlog #{i + 1}
                          </div>
                          <div className="mt-1 text-lg font-semibold text-foreground">
                            {row.title}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{row.authorName || "Unknown"}</span>
                            <span>·</span>
                            <span>
                              {formatDateTime(row.startedAt.toISOString())} →{" "}
                              {formatDateTime(row.endedAt.toISOString())}
                            </span>
                            <span>·</span>
                            <span className="font-semibold text-foreground">
                              {duration.label}
                            </span>
                            {row.usedAi ? (
                              <>
                                <span>·</span>
                                <span className="rounded-full bg-amber-500/15 text-amber-200 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                                  AI
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {row.content ? (
                        <p className="whitespace-pre-wrap text-sm text-foreground/90">
                          {row.content}
                        </p>
                      ) : null}

                      {row.usedAi && row.aiUsageDescription ? (
                        <div className="rounded-[var(--radius-xl)] border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">
                          <span className="font-semibold text-amber-200">AI used:</span>{" "}
                          {row.aiUsageDescription}
                        </div>
                      ) : null}

                      {row.attachments && row.attachments.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {row.attachments.map((url, idx) => (
                            <a
                              key={`${row.id}-att-${idx}`}
                              href={url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="block overflow-hidden rounded-lg  border border-border bg-muted"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt=""
                                className="aspect-video w-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </a>
                          ))}
                        </div>
                      ) : null}

                      {row.hackatimeProjectNameSnapshot ? (
                        <div className="text-xs text-muted-foreground">
                          Hackatime project:{" "}
                          <span className="font-mono text-foreground">
                            {row.hackatimeProjectNameSnapshot}
                          </span>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ol>
        )}
      </PlatformContent>
    </PlatformShell>
  );
}

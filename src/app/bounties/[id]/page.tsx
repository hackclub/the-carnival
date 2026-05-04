import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq, and } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import { Badge } from "@/components/ui";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import { RichTextContent } from "@/components/RichTextContent";
import { db } from "@/db";
import { bountyClaim, bountyProject, project, user } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

function toHelpfulLinks(value: unknown): Array<{ label: string; url: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const label = typeof (item as { label?: unknown }).label === "string" ? (item as { label: string }).label.trim() : "";
      const url = typeof (item as { url?: unknown }).url === "string" ? (item as { url: string }).url.trim() : "";
      return label && url ? { label, url } : null;
    })
    .filter((item): item is { label: string; url: string } => !!item);
}

export default async function BountyDetailPage(props: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session?.user?.id) redirect("/login?callbackUrl=/bounties");

  const role = (session.user as { role?: unknown } | undefined)?.role;
  const isAdmin = role === "admin";
  const { id } = await props.params;

  const rows = await db
    .select({
      id: bountyProject.id,
      name: bountyProject.name,
      description: bountyProject.description,
      prizeUsd: bountyProject.prizeUsd,
      status: bountyProject.status,
      previewImageUrl: bountyProject.previewImageUrl,
      requirements: bountyProject.requirements,
      examples: bountyProject.examples,
      helpfulLinks: bountyProject.helpfulLinks,
      completed: bountyProject.completed,
      createdById: bountyProject.createdById,
      authorName: user.name,
      reviewedAt: bountyProject.reviewedAt,
      rejectionReason: bountyProject.rejectionReason,
      createdAt: bountyProject.createdAt,
    })
    .from(bountyProject)
    .leftJoin(user, eq(bountyProject.createdById, user.id))
    .where(eq(bountyProject.id, id))
    .limit(1);

  const bounty = rows[0];
  if (!bounty) notFound();
  if (!isAdmin && bounty.status !== "approved" && bounty.createdById !== session.user.id) {
    notFound();
  }

  const claims = await db
    .select({ userId: bountyClaim.userId })
    .from(bountyClaim)
    .where(eq(bountyClaim.bountyProjectId, bounty.id));
  const claimedUserIds = new Set(claims.map((claim) => claim.userId));

  const acceptedProjects = await db
    .select({
      id: project.id,
      name: project.name,
      description: project.description,
      screenshots: project.screenshots,
      playableDemoUrl: project.playableDemoUrl,
      codeUrl: project.codeUrl,
      status: project.status,
      approvedHours: project.approvedHours,
      grantedAt: project.updatedAt,
      creatorName: user.name,
    })
    .from(project)
    .leftJoin(user, eq(project.creatorId, user.id))
    .where(and(eq(project.bountyProjectId, bounty.id), eq(project.status, "granted")))
    .orderBy(desc(project.updatedAt));

  const statusVariant =
    bounty.status === "approved" ? "success" : bounty.status === "pending" ? "warning" : "error";

  return (
    <AppShell title="Bounty">
      <div className="mb-6">
        <Link href="/bounties" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to bounties
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {bounty.previewImageUrl ? (
            <div className="overflow-hidden rounded-[var(--radius-2xl)] border-2 border-[var(--carnival-border)] bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bounty.previewImageUrl}
                alt=""
                className="max-h-[420px] w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : null}

          <div className="platform-surface-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-foreground">{bounty.name}</h1>
                  <Badge variant={statusVariant}>{bounty.status}</Badge>
                  {bounty.completed ? <Badge variant="success">Completed</Badge> : null}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  by <span className="font-semibold text-foreground">{bounty.authorName || "Unknown creator"}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Reward</div>
                <div className="text-2xl font-bold text-foreground">
                  ${bounty.prizeUsd.toLocaleString("en-US")}
                </div>
              </div>
            </div>

            <RichTextContent value={bounty.description} className="mt-5 text-muted-foreground" />

            {bounty.requirements ? (
              <section className="mt-6">
                <h2 className="text-lg font-semibold text-foreground">Requirements</h2>
                <RichTextContent value={bounty.requirements} className="mt-2 text-muted-foreground" />
              </section>
            ) : null}

            {bounty.examples ? (
              <section className="mt-6">
                <h2 className="text-lg font-semibold text-foreground">Examples and resources</h2>
                <div className="mt-2 whitespace-pre-wrap leading-6 text-muted-foreground">{bounty.examples}</div>
              </section>
            ) : null}

            {toHelpfulLinks(bounty.helpfulLinks).length > 0 ? (
              <section className="mt-6">
                <h2 className="text-lg font-semibold text-foreground">Helpful links</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {toHelpfulLinks(bounty.helpfulLinks).map((link, idx) => (
                    <Link
                      key={`${link.url}-${idx}`}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-[var(--carnival-squircle-radius)] border-2 border-[var(--carnival-border)] bg-muted px-3 py-1 text-sm font-semibold text-carnival-blue hover:bg-muted/70"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {bounty.status === "rejected" && bounty.rejectionReason ? (
              <div className="mt-6 rounded-[var(--radius-xl)] border border-carnival-red/40 bg-carnival-red/10 px-4 py-3 text-sm text-red-200">
                {bounty.rejectionReason}
              </div>
            ) : null}
          </div>

          <section className="platform-surface-card p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-foreground">Projects that made it</h2>
              <div className="text-sm text-muted-foreground">{acceptedProjects.length} granted</div>
            </div>

            {acceptedProjects.length === 0 ? (
              <div className="mt-4 text-muted-foreground">No granted projects under this bounty yet.</div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                {acceptedProjects.map((p) => {
                  const firstScreenshot = p.screenshots.find((url) => url.trim().length > 0);
                  return (
                    <article key={p.id} className="rounded-[var(--radius-xl)]  border-2 border-[var(--carnival-border)] bg-muted/40 p-4">
                      {firstScreenshot ? (
                        <div className="mb-3 h-32 overflow-hidden rounded-[var(--radius-lg)]  border-2 border-[var(--carnival-border)] bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={firstScreenshot}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : null}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-bold text-foreground">{p.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            by {p.creatorName || "Unknown creator"}
                          </div>
                        </div>
                        <ProjectStatusBadge status={p.status} />
                      </div>
                      <div className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{p.description}</div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        {p.approvedHours !== null && p.approvedHours !== undefined ? `${p.approvedHours}h approved • ` : ""}
                        Granted {p.grantedAt.toLocaleString()}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {p.playableDemoUrl ? (
                          <Link
                            href={p.playableDemoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-[var(--radius-xl)]  border-2 border-[var(--carnival-border)] bg-background px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-muted"
                          >
                            Play
                          </Link>
                        ) : null}
                        <Link
                          href={p.codeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-[var(--radius-xl)]  border-2 border-[var(--carnival-border)] bg-background px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-muted"
                        >
                          Code
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="h-fit platform-surface-card p-6">
          <div className="text-sm text-muted-foreground">Claims</div>
          <div className="mt-1 text-2xl font-bold text-foreground">{claimedUserIds.size}/2</div>
          <div className="mt-4 text-sm text-muted-foreground">
            Created {bounty.createdAt.toLocaleString()}
            {bounty.reviewedAt ? ` • Reviewed ${bounty.reviewedAt.toLocaleString()}` : ""}
          </div>
          <Link
            href="/projects?new=1"
            className="mt-5 inline-flex w-full items-center justify-center rounded-[var(--radius-xl)] bg-carnival-red px-4 py-2.5 font-bold text-white transition-colors hover:bg-carnival-red/80"
          >
            Start a project
          </Link>
        </aside>
      </div>
    </AppShell>
  );
}

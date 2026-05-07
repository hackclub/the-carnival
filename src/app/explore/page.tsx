import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getServerSession } from "@/lib/server-session";
import { slack } from "@/lib/slack";
import Link from "next/link";
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { devlog, project, user } from "@/db/schema";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import ProjectEditorBadge from "@/components/ProjectEditorBadge";
import ExploreProjectsFilters from "@/components/ExploreProjectsFilters";
import { formatDurationHM } from "@/lib/devlog-shared";
import {
  buildCategorySuggestions,
  buildTagSuggestions,
  formatCategoryLabel,
  formatTagLabel,
  normalizeCategory,
  normalizeTag,
} from "@/lib/project-taxonomy";

type ExploreStatusFilter = "all" | "shipped" | "granted";
type ExploreTab = "devlogs" | "projects";

const STATUS_FILTERS: Array<{ value: ExploreStatusFilter; label: string; statuses: Array<"shipped" | "granted"> }> =
  [
    { value: "all", label: "All", statuses: ["shipped", "granted"] },
    { value: "shipped", label: "Shipped", statuses: ["shipped"] },
    { value: "granted", label: "Granted", statuses: ["granted"] },
  ];

function toSingleValue(input: string | string[] | undefined) {
  return Array.isArray(input) ? input[0] : input;
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function formatRelativeTime(date: Date) {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

function formatShortDateTime(date: Date) {
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/explore");
  }

  const sp = await searchParams;
  const tabParam = toSingleValue(sp?.tab);
  const activeTab: ExploreTab = tabParam === "projects" ? "projects" : "devlogs";
  const statusParam = toSingleValue(sp?.status);
  const allowedStatus = new Set(STATUS_FILTERS.map((filter) => filter.value));
  const activeStatus: ExploreStatusFilter = allowedStatus.has(statusParam as ExploreStatusFilter)
    ? (statusParam as ExploreStatusFilter)
    : "all";
  const activeStatusConfig = STATUS_FILTERS.find((filter) => filter.value === activeStatus) ?? STATUS_FILTERS[0]!;

  const query = (toSingleValue(sp?.q) ?? "").trim().slice(0, 120);
  const activeCategory = normalizeCategory(toSingleValue(sp?.category));
  const activeTag = normalizeTag(toSingleValue(sp?.tag));

  const statusWhere = inArray(project.status, activeStatusConfig.statuses);
  const whereParts: SQL[] = [statusWhere];

  if (query) {
    const pattern = `%${escapeLikePattern(query)}%`;
    whereParts.push(
      or(ilike(project.name, pattern), ilike(project.description, pattern), ilike(user.slackId, pattern)) as SQL,
    );
  }

  if (activeCategory) {
    whereParts.push(eq(project.category, activeCategory));
  }

  if (activeTag) {
    whereParts.push(sql`${project.tags} @> ARRAY[${activeTag}]::text[]`);
  }

  const latestDevlogs =
    activeTab === "devlogs"
      ? await db
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
            projectId: project.id,
            projectName: project.name,
            authorName: user.name,
          })
          .from(devlog)
          .innerJoin(project, eq(devlog.projectId, project.id))
          .leftJoin(user, eq(devlog.userId, user.id))
          .orderBy(desc(devlog.createdAt))
          .limit(30)
      : [];

  const projects =
    activeTab === "projects"
      ? await db
          .select({
            id: project.id,
            name: project.name,
            description: project.description,
            category: project.category,
            tags: project.tags,
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
          .where(whereParts.length === 1 ? whereParts[0] : and(...whereParts))
          .orderBy(desc(project.createdAt))
      : [];

  const taxonomyRows =
    activeTab === "projects"
      ? await db
          .select({
            category: project.category,
            tags: project.tags,
          })
          .from(project)
          .where(statusWhere)
      : [];

  const categoryOptions = buildCategorySuggestions(taxonomyRows.map((row) => row.category));
  const tagOptions = buildTagSuggestions(taxonomyRows.map((row) => row.tags));

  const slackIds = Array.from(
    new Set(projects.map((projectRow) => projectRow.creatorSlackId).filter((id): id is string => !!id)),
  );
  const slackNameById = new Map<string, string>();
  if (slack) {
    if (slackIds.length) {
      const slackClient = slack;
      const lookups = await Promise.allSettled(
        slackIds.map(async (id) => {
          const info = await slackClient.users.info({ user: id });
          const userInfo = (info as { user?: { name?: string; profile?: { display_name?: string } } }).user;
          const displayName = userInfo?.profile?.display_name?.trim();
          const name = userInfo?.name?.trim();
          const label = displayName || name || id;
          slackNameById.set(id, label);
        }),
      );
      if (lookups.some((result) => result.status === "rejected")) {
        console.warn("Failed to fetch some Slack usernames for Explore.");
      }
    }
  } else if (slackIds.length) {
    slackIds.forEach((id) => {
      slackNameById.set(id, id);
    });
  }

  return (
    <AppShell title="Explore">
      <div className="mb-6 flex flex-wrap gap-2 platform-surface-card p-2">
        <Link
          href="/explore?tab=devlogs"
          className={`rounded-[var(--radius-xl)] px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "devlogs"
              ? "bg-carnival-red text-white"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          Devlogs
        </Link>
        <Link
          href="/explore?tab=projects"
          className={`rounded-[var(--radius-xl)] px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "projects"
              ? "bg-carnival-red text-white"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          Projects
        </Link>
      </div>

      {activeTab === "devlogs" ? (
        latestDevlogs.length === 0 ? (
          <div className="platform-surface-card p-8">
            <div className="text-foreground font-semibold text-lg">No devlogs yet</div>
            <div className="text-muted-foreground mt-1">
              When people post devlogs, the latest updates will show up here.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {latestDevlogs.map((devlogRow) => {
              const duration = formatDurationHM(devlogRow.durationSeconds);
              const firstAttachment = devlogRow.attachments.find((url) => url.trim().length > 0);

              return (
                <Link
                  key={devlogRow.id}
                  href={`/projects/${devlogRow.projectId}/devlogs/${devlogRow.id}`}
                  className="block platform-surface-card p-5 transition-colors hover:bg-muted"
                >
                  <div className="flex gap-4">
                    {firstAttachment ? (
                      <div className="hidden h-24 w-32 shrink-0 overflow-hidden rounded-[var(--radius-xl)]  border border-border bg-muted sm:block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={firstAttachment}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{devlogRow.authorName || "Unknown creator"}</span>
                        <span>on</span>
                        <span className="font-semibold text-foreground">{devlogRow.projectName}</span>
                        <span>·</span>
                        <span title={formatShortDateTime(devlogRow.createdAt)}>
                          {formatRelativeTime(devlogRow.createdAt)}
                        </span>
                      </div>
                      <div className="mt-2 truncate text-lg font-bold text-foreground">
                        {devlogRow.title}
                      </div>
                      <div className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {devlogRow.content}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-[var(--carnival-squircle-radius)] border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground">
                          {duration.label}
                        </span>
                        {devlogRow.usedAi ? (
                          <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
                            AI
                          </span>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {formatShortDateTime(devlogRow.startedAt)} to {formatShortDateTime(devlogRow.endedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )
      ) : (
        <>
          <form className="mb-6 platform-surface-card p-4 md:p-5">
            <input type="hidden" name="tab" value="projects" />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
              <label className="xl:col-span-2">
                <span className="block text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">
                  Search
                </span>
                <input
                  name="q"
                  defaultValue={query}
                  placeholder="Project, description, or creator..."
                  className="w-full bg-background border border-border rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
                />
              </label>

              <ExploreProjectsFilters
                key={`${activeStatus}|${activeCategory ?? ""}|${activeTag ?? ""}|${query}`}
                statusOptions={STATUS_FILTERS.map((filter) => ({
                  value: filter.value,
                  label: filter.label,
                }))}
                categoryOptions={categoryOptions.map((value) => ({
                  value,
                  label: formatCategoryLabel(value) ?? value,
                }))}
                tagOptions={tagOptions.map((value) => ({
                  value,
                  label: formatTagLabel(value) ?? value,
                }))}
                initialStatus={activeStatus}
                initialCategory={activeCategory ?? ""}
                initialTag={activeTag ?? ""}
              />
            </div>

            <div className="mt-3 flex items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 text-white px-4 py-2.5 rounded-[var(--radius-xl)] font-semibold transition-colors"
              >
                Apply filters
              </button>
              <Link
                href="/explore?tab=projects"
                className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 text-foreground px-4 py-2.5 rounded-[var(--radius-xl)] font-semibold transition-colors border border-border"
              >
                Clear
              </Link>
            </div>
          </form>

          {projects.length === 0 ? (
            <div className="platform-surface-card p-8">
              <div className="text-foreground font-semibold text-lg">No projects match these filters</div>
              <div className="text-muted-foreground mt-1">
                Try removing one or more filters to broaden results.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {projects.map((projectRow) => {
                const firstScreenshot = projectRow.screenshots.find((url) => url.trim().length > 0);
                const categoryLabel = formatCategoryLabel(projectRow.category);
                const tagLabels = (projectRow.tags ?? [])
                  .map((tag) => formatTagLabel(tag))
                  .filter((value): value is string => !!value);

                return (
                  <div
                    key={projectRow.id}
                    className="platform-surface-card p-6 card-glow transition-all hover:bg-muted h-full min-h-[380px]"
                  >
                    <div className="flex h-full flex-col">
                      {firstScreenshot ? (
                        <div className="mb-4 overflow-hidden rounded-[var(--radius-xl)]  border border-border bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={firstScreenshot}
                            alt={`${projectRow.name} screenshot`}
                            className="h-40 w-full object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="mb-4 flex h-40 w-full items-center justify-center rounded-[var(--radius-xl)]  border border-border bg-muted text-sm text-muted-foreground">
                          No screenshot
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-foreground font-bold text-xl truncate">{projectRow.name}</div>
                          <div className="text-muted-foreground text-sm mt-1 truncate">
                            by
                            {projectRow.creatorSlackId && slackNameById.get(projectRow.creatorSlackId)
                              ? ` @${slackNameById.get(projectRow.creatorSlackId)}`
                              : " Unknown creator"}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <ProjectEditorBadge editor={projectRow.editor} editorOther={projectRow.editorOther} />
                          <ProjectStatusBadge status={projectRow.status} />
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {categoryLabel ? (
                          <span className="inline-flex items-center rounded-[var(--carnival-squircle-radius)] border border-border bg-muted px-2.5 py-1 text-xs text-foreground">
                            {categoryLabel}
                          </span>
                        ) : null}
                        {tagLabels.slice(0, 3).map((tag) => (
                          <span
                            key={`${projectRow.id}-${tag}`}
                            className="inline-flex items-center rounded-[var(--carnival-squircle-radius)] border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>

                      <div className="text-muted-foreground mt-3 text-sm leading-6 line-clamp-4">
                        {projectRow.description}
                      </div>

                      <div className="mt-auto pt-5 flex items-center gap-3">
                        {projectRow.playableDemoUrl || projectRow.videoUrl ? (
                          <Link
                            href={projectRow.playableDemoUrl || projectRow.videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 text-foreground px-4 py-2 rounded-[var(--radius-xl)] font-semibold transition-colors border border-border text-sm"
                          >
                            Play
                          </Link>
                        ) : null}
                        <Link
                          href={projectRow.codeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 text-foreground px-4 py-2 rounded-[var(--radius-xl)] font-semibold transition-colors border border-border text-sm"
                        >
                          Code
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

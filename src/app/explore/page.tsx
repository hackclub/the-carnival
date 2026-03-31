import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getServerSession } from "@/lib/server-session";
import { slack } from "@/lib/slack";
import Link from "next/link";
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { project, user } from "@/db/schema";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import ProjectEditorBadge from "@/components/ProjectEditorBadge";
import {
  buildCategorySuggestions,
  buildTagSuggestions,
  formatCategoryLabel,
  formatTagLabel,
  normalizeCategory,
  normalizeTag,
} from "@/lib/project-taxonomy";

type ExploreStatusFilter = "all" | "shipped" | "granted";

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

export default async function ExplorePage({
  searchParams,
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/explore");
  }

  const sp = await searchParams;
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

  const projects = await db
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
    .orderBy(desc(project.createdAt));

  const taxonomyRows = await db
    .select({
      category: project.category,
      tags: project.tags,
    })
    .from(project)
    .where(statusWhere);

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
      <form className="mb-6 bg-card border border-border rounded-2xl p-4 md:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <label className="xl:col-span-2">
            <span className="block text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">
              Search
            </span>
            <input
              name="q"
              defaultValue={query}
              placeholder="Project, description, or creator…"
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
            />
          </label>

          <label>
            <span className="block text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">
              Status
            </span>
            <select
              name="status"
              defaultValue={activeStatus}
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
            >
              {STATUS_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="block text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">
              Category
            </span>
            <select
              name="category"
              defaultValue={activeCategory ?? ""}
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
            >
              <option value="">All categories</option>
              {categoryOptions.map((value) => (
                <option key={value} value={value}>
                  {formatCategoryLabel(value) ?? value}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="block text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">
              Tag
            </span>
            <select
              name="tag"
              defaultValue={activeTag ?? ""}
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
            >
              <option value="">All tags</option>
              {tagOptions.map((value) => (
                <option key={value} value={value}>
                  {formatTagLabel(value) ?? value}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 text-white px-4 py-2.5 rounded-xl font-semibold transition-colors"
          >
            Apply filters
          </button>
          <Link
            href="/explore"
            className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 text-foreground px-4 py-2.5 rounded-xl font-semibold transition-colors border border-border"
          >
            Clear
          </Link>
        </div>
      </form>

      {projects.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8">
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
                className="bg-card border border-border rounded-2xl p-6 card-glow transition-all hover:bg-muted h-full min-h-[380px]"
              >
                <div className="flex h-full flex-col">
                  {firstScreenshot ? (
                    <div className="mb-4 overflow-hidden rounded-xl border border-border bg-muted">
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
                    <div className="mb-4 flex h-40 w-full items-center justify-center rounded-xl border border-border bg-muted text-sm text-muted-foreground">
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
                      <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-foreground">
                        {categoryLabel}
                      </span>
                    ) : null}
                    {tagLabels.slice(0, 3).map((tag) => (
                      <span
                        key={`${projectRow.id}-${tag}`}
                        className="inline-flex items-center rounded-full border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground"
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
                        className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 text-foreground px-4 py-2 rounded-full font-semibold transition-colors border border-border text-sm"
                      >
                        Play
                      </Link>
                    ) : null}
                    <Link
                      href={projectRow.codeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 text-foreground px-4 py-2 rounded-full font-semibold transition-colors border border-border text-sm"
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
    </AppShell>
  );
}

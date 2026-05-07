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
import ExploreProjectsFilters from "@/components/ExploreProjectsFilters";
import {
  buildCategorySuggestions,
  buildTagSuggestions,
  formatCategoryLabel,
  formatTagLabel,
  normalizeCategory,
  normalizeTag,
} from "@/lib/project-taxonomy";

type ExploreStatusFilter = "all" | "shipped" | "granted";

const STATUS_FILTERS: Array<{
  value: ExploreStatusFilter;
  label: string;
  statuses: Array<"shipped" | "granted">;
}> = [
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
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/explore");
  }

  const sp = await searchParams;
  const statusParam = toSingleValue(sp?.status);
  const allowedStatus = new Set(STATUS_FILTERS.map((f) => f.value));
  const activeStatus: ExploreStatusFilter = allowedStatus.has(
    statusParam as ExploreStatusFilter,
  )
    ? (statusParam as ExploreStatusFilter)
    : "all";
  const activeStatusConfig =
    STATUS_FILTERS.find((f) => f.value === activeStatus) ?? STATUS_FILTERS[0]!;

  const query = (toSingleValue(sp?.q) ?? "").trim().slice(0, 120);
  const activeCategory = normalizeCategory(toSingleValue(sp?.category));
  const activeTag = normalizeTag(toSingleValue(sp?.tag));

  const statusWhere = inArray(project.status, activeStatusConfig.statuses);
  const whereParts: SQL[] = [statusWhere];

  if (query) {
    const pattern = `%${escapeLikePattern(query)}%`;
    whereParts.push(
      or(
        ilike(project.name, pattern),
        ilike(project.description, pattern),
        ilike(user.slackId, pattern),
      ) as SQL,
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
      previewImage: project.previewImage,
      screenshots: project.screenshots,
      status: project.status,
      createdAt: project.createdAt,
      creatorSlackId: user.slackId,
    })
    .from(project)
    .leftJoin(user, eq(project.creatorId, user.id))
    .where(
      whereParts.length === 1 ? whereParts[0] : and(...whereParts),
    )
    .orderBy(desc(project.createdAt));

  const taxonomyRows = await db
    .select({ category: project.category, tags: project.tags })
    .from(project)
    .where(statusWhere);

  const categoryOptions = buildCategorySuggestions(
    taxonomyRows.map((r) => r.category),
  );
  const tagOptions = buildTagSuggestions(taxonomyRows.map((r) => r.tags));

  const slackIds = Array.from(
    new Set(
      projects
        .map((p) => p.creatorSlackId)
        .filter((id): id is string => !!id),
    ),
  );
  const slackNameById = new Map<string, string>();
  if (slack && slackIds.length) {
    const slackClient = slack;
    const lookups = await Promise.allSettled(
      slackIds.map(async (id) => {
        const info = await slackClient.users.info({ user: id });
        const u = (
          info as {
            user?: { name?: string; profile?: { display_name?: string } };
          }
        ).user;
        const label =
          u?.profile?.display_name?.trim() || u?.name?.trim() || id;
        slackNameById.set(id, label);
      }),
    );
    if (lookups.some((r) => r.status === "rejected")) {
      console.warn("Failed to fetch some Slack usernames for Explore.");
    }
  } else {
    slackIds.forEach((id) => slackNameById.set(id, id));
  }

  return (
    <AppShell title="Explore">
      <form className="mb-6 platform-surface-card p-4 md:p-5">
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
            statusOptions={STATUS_FILTERS.map((f) => ({
              value: f.value,
              label: f.label,
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
            href="/explore"
            className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 text-foreground px-4 py-2.5 rounded-[var(--radius-xl)] font-semibold transition-colors border border-border"
          >
            Clear
          </Link>
        </div>
      </form>

      {projects.length === 0 ? (
        <div className="platform-surface-card p-8">
          <div className="text-foreground font-semibold text-lg">
            No projects match these filters
          </div>
          <div className="text-muted-foreground mt-1">
            Try removing one or more filters to broaden results.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {projects.map((p) => {
            const cardImage =
              p.previewImage?.trim() ||
              p.screenshots.find((url) => url.trim().length > 0) ||
              "";
            const categoryLabel = formatCategoryLabel(p.category);
            const tagLabels = (p.tags ?? [])
              .map((tag) => formatTagLabel(tag))
              .filter((v): v is string => !!v);

            return (
              <Link
                key={p.id}
                href={`/p/${p.id}`}
                className="platform-surface-card card-glow transition-all hover:bg-muted block overflow-hidden h-full"
              >
                {cardImage ? (
                  <div className="border-b border-border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cardImage}
                      alt={`${p.name} preview`}
                      className="h-40 w-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center border-b border-border bg-muted/50 text-sm text-muted-foreground">
                    No preview
                  </div>
                )}

                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-foreground font-bold text-lg truncate">
                        {p.name}
                      </div>
                      <div className="text-muted-foreground text-sm mt-0.5 truncate">
                        by{" "}
                        {p.creatorSlackId &&
                        slackNameById.get(p.creatorSlackId)
                          ? `@${slackNameById.get(p.creatorSlackId)}`
                          : "Unknown"}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <ProjectEditorBadge
                        editor={p.editor}
                        editorOther={p.editorOther}
                      />
                      <ProjectStatusBadge status={p.status} />
                    </div>
                  </div>

                  {(categoryLabel || tagLabels.length > 0) && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {categoryLabel ? (
                        <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground">
                          {categoryLabel}
                        </span>
                      ) : null}
                      {tagLabels.slice(0, 3).map((tag) => (
                        <span
                          key={`${p.id}-${tag}`}
                          className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="text-muted-foreground mt-2.5 text-sm leading-relaxed line-clamp-3">
                    {p.description}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

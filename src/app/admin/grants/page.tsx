import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, inArray } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import ProjectEditorBadge from "@/components/ProjectEditorBadge";
import { db } from "@/db";
import { project } from "@/db/schema";
import { formatCategoryLabel, formatTagLabel } from "@/lib/project-taxonomy";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type FilterKey = "all" | "granted" | "shipped";

const FILTERS: Array<{ label: string; value: FilterKey; statuses: Array<"shipped" | "granted"> }> = [
  { label: "All", value: "all", statuses: ["shipped", "granted"] },
  { label: "Granted", value: "granted", statuses: ["granted"] },
  { label: "Shipped", value: "shipped", statuses: ["shipped"] },
];

export default async function AdminGrantsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession({ disableCookieCache: true });
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/grants");
  if (role !== "admin") redirect("/projects");

  const sp = await searchParams;
  const rawStatus = sp?.status;
  const statusParam = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
  const allowed = new Set(FILTERS.map((f) => f.value));
  const activeFilter: FilterKey = allowed.has(statusParam as FilterKey)
    ? (statusParam as FilterKey)
    : "all";
  const active = FILTERS.find((f) => f.value === activeFilter) ?? FILTERS[0];

  const rows = await db
    .select({
      id: project.id,
      name: project.name,
      description: project.description,
      category: project.category,
      tags: project.tags,
      editor: project.editor,
      editorOther: project.editorOther,
      status: project.status,
      createdAt: project.createdAt,
      submittedAt: project.submittedAt,
    })
    .from(project)
    .where(inArray(project.status, active.statuses))
    .orderBy(desc(project.createdAt));

  return (
    <AppShell title="Grants">
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const isActive = f.value === activeFilter;
          return (
            <Link
              key={f.value}
              href={`/admin/grants?status=${f.value}`}
              className={`inline-flex items-center rounded-[var(--radius-xl)] border px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? "bg-carnival-red text-white border-carnival-red"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="mb-6 text-sm text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{active.label.toLowerCase()}</span> projects{" "}
        <span className="text-muted-foreground">({rows.length})</span>
      </div>

      {rows.length === 0 ? (
        <div className="platform-surface-card p-8">
          <div className="text-foreground font-semibold text-lg">
            {activeFilter === "granted"
              ? "No granted projects"
              : activeFilter === "shipped"
                ? "No shipped projects"
                : "No projects"}
          </div>
          <div className="text-muted-foreground mt-1">
            {activeFilter === "granted"
              ? "Projects show up here after they’ve been granted."
              : activeFilter === "shipped"
                ? "Shipped projects show up here so you can grant them."
                : "Shipped and granted projects show up here so you can manage grants."}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {rows.map((p) => (
            <Link
              key={p.id}
              href={`/admin/grants/${p.id}`}
              className="platform-surface-card p-6 card-glow transition-all hover:bg-muted block h-full min-h-[300px]"
            >
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-foreground font-bold text-xl truncate">{p.name}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {p.category ? (
                        <span className="inline-flex items-center rounded-[var(--carnival-squircle-radius)] border-2 border-[var(--carnival-border)] bg-muted px-2.5 py-1 text-xs text-foreground">
                          {formatCategoryLabel(p.category) ?? p.category}
                        </span>
                      ) : null}
                      {(p.tags ?? []).slice(0, 3).map((tag) => (
                        <span
                          key={`${p.id}-${tag}`}
                          className="inline-flex items-center rounded-[var(--carnival-squircle-radius)] border-2 border-[var(--carnival-border)] bg-background px-2 py-1 text-[11px] text-muted-foreground"
                        >
                          #{formatTagLabel(tag) ?? tag}
                        </span>
                      ))}
                    </div>
                    <div className="text-muted-foreground mt-3 line-clamp-4 leading-6">{p.description}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <ProjectEditorBadge editor={p.editor} editorOther={p.editorOther} />
                    <ProjectStatusBadge status={p.status} />
                  </div>
                </div>

                <div className="mt-auto pt-4 text-xs text-muted-foreground">
                  Submitted: {p.submittedAt ? p.submittedAt.toLocaleString() : "—"} • Created:{" "}
                  {p.createdAt.toLocaleString()}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}

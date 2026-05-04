"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ProjectEditorBadge from "@/components/ProjectEditorBadge";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import {
  formatCategoryLabel,
  formatTagLabel,
  normalizeCategory,
  normalizeTag,
} from "@/lib/project-taxonomy";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ReviewQueueProject = {
  id: string;
  name: string;
  description: string;
  category: string | null;
  tags: string[];
  editor: string;
  editorOther: string | null;
  status: string;
  createdAt: string;
  submittedAt: string | null;
  creatorName: string | null;
  assignmentCount: number;
  isAssignedToMe: boolean;
  assignments: Array<{
    reviewerId: string;
    reviewerName: string;
    reviewerEmail: string;
    createdAt: string;
  }>;
  latestReview: {
    decision: string;
    approvedHours: number | null;
    createdAt: string;
    reviewerName: string;
  } | null;
};

type FilterKey = "pending" | "approved" | "rejected";
type SortKey =
  | "queue-age-desc"
  | "submitted-desc"
  | "submitted-asc"
  | "last-review-desc"
  | "name-asc";
type AssignmentFilter = "all" | "mine" | "assigned" | "unassigned";

type ReviewQueueResponse = {
  projects?: ReviewQueueProject[];
  filters?: {
    categories?: string[];
    tags?: string[];
  };
  error?: string;
};

const FILTERS: Array<{ value: FilterKey }> = [
  { value: "pending" },
  { value: "approved" },
  { value: "rejected" },
];

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "queue-age-desc", label: "Oldest in queue" },
  { value: "submitted-desc", label: "Newest submitted" },
  { value: "submitted-asc", label: "Oldest submitted" },
  { value: "last-review-desc", label: "Recently reviewed" },
  { value: "name-asc", label: "Name A-Z" },
];

const ASSIGNMENT_OPTIONS: Array<{ value: AssignmentFilter; label: string }> = [
  { value: "all", label: "All assignments" },
  { value: "mine", label: "Assigned to me" },
  { value: "unassigned", label: "Unassigned only" },
  { value: "assigned", label: "Assigned only" },
];

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return "—";
  return value.toLocaleString();
}

function formatQueueAge(submittedAtIso: string | null, createdAtIso: string) {
  const source = submittedAtIso ?? createdAtIso;
  const started = new Date(source).getTime();
  if (!Number.isFinite(started)) return "—";

  const deltaMs = Date.now() - started;
  if (!Number.isFinite(deltaMs) || deltaMs < 0) return "just now";

  const totalMinutes = Math.floor(deltaMs / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) return `${totalHours}h`;
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours === 0 ? `${days}d` : `${days}d ${hours}h`;
}

function formatLatestReview(
  latestReview: ReviewQueueProject["latestReview"],
  fallbackSubmittedAt: string | null,
  fallbackCreatedAt: string,
) {
  if (!latestReview) return "No review yet";
  const decision =
    latestReview.decision.charAt(0).toUpperCase() + latestReview.decision.slice(1);
  const hoursText =
    latestReview.approvedHours !== null && latestReview.approvedHours !== undefined
      ? ` • ${latestReview.approvedHours}h`
      : "";
  const at = formatDateTime(latestReview.createdAt);
  const queued = formatQueueAge(fallbackSubmittedAt, fallbackCreatedAt);
  return `${decision}${hoursText} by ${latestReview.reviewerName} • ${at} • queue ${queued}`;
}

function summarizeAssignments(project: ReviewQueueProject) {
  if (project.assignmentCount === 0) return "Unassigned";
  const names = project.assignments.slice(0, 2).map((a) => a.reviewerName);
  const suffix = project.assignmentCount > 2 ? ` +${project.assignmentCount - 2}` : "";
  const mine = project.isAssignedToMe ? " (includes you)" : "";
  return `${names.join(", ")}${suffix}${mine}`;
}

export default function ReviewQueueClient() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const rawStatus = searchParams.get("status");
  const rawSort = searchParams.get("sort");
  const rawAssignment = searchParams.get("assignment");
  const rawCategory = searchParams.get("category");
  const rawTag = searchParams.get("tag");
  const query = (searchParams.get("q") ?? "").trim();

  const allowed = useMemo(() => new Set(FILTERS.map((f) => f.value)), []);
  const activeFilter: FilterKey = allowed.has(rawStatus as FilterKey)
    ? (rawStatus as FilterKey)
    : "pending";
  const activeSort: SortKey = SORT_OPTIONS.some((option) => option.value === rawSort)
    ? (rawSort as SortKey)
    : "queue-age-desc";
  const activeAssignment: AssignmentFilter = ASSIGNMENT_OPTIONS.some(
    (option) => option.value === rawAssignment,
  )
    ? (rawAssignment as AssignmentFilter)
    : "all";
  const activeCategory = normalizeCategory(rawCategory);
  const activeTag = normalizeTag(rawTag);

  const [queryDraft, setQueryDraft] = useState(query);
  const [projects, setProjects] = useState<ReviewQueueProject[] | null>(null);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQueryDraft(query);
  }, [query]);

  const replaceParams = useCallback(
    (mutator: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutator(params);
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    let cancelled = false;
    setProjects(null);
    setError(null);

    const params = new URLSearchParams();
    params.set("status", activeFilter);
    params.set("sort", activeSort);
    params.set("assignment", activeAssignment);
    if (query) params.set("q", query);
    if (activeCategory) params.set("category", activeCategory);
    if (activeTag) params.set("tag", activeTag);

    fetch(`/api/review/projects?${params.toString()}`, { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as ReviewQueueResponse | null;
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load projects.");
        }
        if (cancelled) return;
        setProjects(data?.projects ?? []);
        setAvailableCategories(data?.filters?.categories ?? []);
        setAvailableTags(data?.filters?.tags ?? []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load projects.");
        setProjects([]);
      });

    return () => {
      cancelled = true;
    };
  }, [activeAssignment, activeCategory, activeFilter, activeSort, activeTag, query]);

  const onSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      replaceParams((params) => {
        const next = queryDraft.trim();
        if (next) params.set("q", next);
        else params.delete("q");
      });
    },
    [queryDraft, replaceParams],
  );

  if (projects === null) {
    return (
      <div className="platform-surface-card p-8">
        <div className="text-foreground font-semibold text-lg">Loading projects…</div>
        <div className="text-muted-foreground mt-1">Fetching the latest review queue.</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="platform-surface-card p-8">
        <div className="text-foreground font-semibold text-lg">Could not load projects</div>
        <div className="text-muted-foreground mt-1">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="platform-surface-card p-4 md:p-5">
        <form onSubmit={onSearchSubmit} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <label className="xl:col-span-2">
            <span className="block text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">
              Search
            </span>
            <input
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              placeholder="Project, description, creator…"
              className="w-full bg-background border border-border rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
            />
          </label>
          <div>
            <span className="block text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">
              Sort
            </span>
            <Select
              value={activeSort}
              onValueChange={(v) => { if (v) replaceParams((params) => params.set("sort", v)); }}
            >
              <SelectTrigger className="w-full h-11 rounded-[var(--radius-xl)] border-input bg-background px-3 text-sm text-foreground">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className="block text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">
              Assignment
            </span>
            <Select
              value={activeAssignment}
              onValueChange={(v) => { if (v) replaceParams((params) => params.set("assignment", v)); }}
            >
              <SelectTrigger className="w-full h-11 rounded-[var(--radius-xl)] border-input bg-background px-3 text-sm text-foreground">
                <SelectValue placeholder="Assignment" />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNMENT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 text-white px-4 py-2.5 rounded-[var(--radius-xl)] font-semibold transition-colors"
            >
              Apply
            </button>
          </div>
        </form>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <span className="block text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">
              Category
            </span>
            <Select
              value={activeCategory ?? "__all__"}
              onValueChange={(v) => {
                if (!v) return;
                replaceParams((params) => {
                  if (v === "__all__") params.delete("category");
                  else params.set("category", v);
                });
              }}
            >
              <SelectTrigger className="w-full h-11 rounded-[var(--radius-xl)] border-input bg-background px-3 text-sm text-foreground">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All categories</SelectItem>
                {availableCategories.map((value) => (
                  <SelectItem key={value} value={value}>
                    {formatCategoryLabel(value) ?? value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className="block text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">
              Tag
            </span>
            <Select
              value={activeTag ?? "__all__"}
              onValueChange={(v) => {
                if (!v) return;
                replaceParams((params) => {
                  if (v === "__all__") params.delete("tag");
                  else params.set("tag", v);
                });
              }}
            >
              <SelectTrigger className="w-full h-11 rounded-[var(--radius-xl)] border-input bg-background px-3 text-sm text-foreground">
                <SelectValue placeholder="All tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All tags</SelectItem>
                {availableTags.map((value) => (
                  <SelectItem key={value} value={value}>
                    {formatTagLabel(value) ?? value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="platform-surface-card p-8">
          <div className="text-foreground font-semibold text-lg">No projects match these filters</div>
          <div className="text-muted-foreground mt-1">
            Adjust search, assignment, category, or tag filters to broaden the queue.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {projects.map((projectRow) => {
            const categoryLabel = formatCategoryLabel(projectRow.category);
            const tagLabels = (projectRow.tags ?? [])
              .map((tag) => formatTagLabel(tag))
              .filter((value): value is string => !!value);

            return (
              <Link
                key={projectRow.id}
                href={`/review/${projectRow.id}`}
                className="platform-surface-card p-5 card-glow transition-all hover:bg-muted block h-full min-h-[340px]"
                aria-label={`Review ${projectRow.name}`}
              >
                <div className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-foreground font-bold text-xl truncate">{projectRow.name}</div>
                      <div className="text-muted-foreground text-sm mt-1 truncate">
                        by {projectRow.creatorName || "Unknown creator"}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <ProjectEditorBadge
                        editor={
                          projectRow.editor as
                            | "vscode"
                            | "chrome"
                            | "firefox"
                            | "figma"
                            | "neovim"
                            | "gnu-emacs"
                            | "jupyterlab"
                            | "obsidian"
                            | "blender"
                            | "freecad"
                            | "kicad"
                            | "krita"
                            | "gimp"
                            | "inkscape"
                            | "godot-engine"
                            | "unity"
                            | "other"
                        }
                        editorOther={projectRow.editorOther ?? ""}
                      />
                      <ProjectStatusBadge
                        status={
                          projectRow.status as "shipped" | "granted" | "in-review" | "work-in-progress"
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {categoryLabel ? (
                      <span className="inline-flex items-center rounded-[var(--carnival-squircle-radius)] border-2 border-[var(--carnival-border)] bg-muted px-2.5 py-1 text-xs text-foreground">
                        {categoryLabel}
                      </span>
                    ) : null}
                    {tagLabels.slice(0, 3).map((tag) => (
                      <span
                        key={`${projectRow.id}-${tag}`}
                        className="inline-flex items-center rounded-[var(--carnival-squircle-radius)] border-2 border-[var(--carnival-border)] bg-background px-2 py-1 text-[11px] text-muted-foreground"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <div className="text-muted-foreground mt-3 text-sm leading-6 line-clamp-4">
                    {projectRow.description}
                  </div>

                  <div className="mt-auto pt-4 space-y-1.5">
                    <div className="text-xs text-muted-foreground">
                      Submitted: {formatDateTime(projectRow.submittedAt)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Queue age: {formatQueueAge(projectRow.submittedAt, projectRow.createdAt)}
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      Latest review:{" "}
                      {formatLatestReview(
                        projectRow.latestReview,
                        projectRow.submittedAt,
                        projectRow.createdAt,
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      Assignments: {summarizeAssignments(projectRow)}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

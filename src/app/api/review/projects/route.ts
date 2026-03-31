import { NextResponse } from "next/server";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  peerReview,
  project,
  projectReviewerAssignment,
  user,
  type ProjectStatus,
  type UserRole,
} from "@/db/schema";
import {
  buildCategorySuggestions,
  buildTagSuggestions,
  normalizeCategory,
  normalizeTag,
} from "@/lib/project-taxonomy";
import { getServerSession } from "@/lib/server-session";

function canReview(role: unknown): role is Extract<UserRole, "reviewer" | "admin"> {
  return role === "reviewer" || role === "admin";
}

type FilterKey = "pending" | "approved" | "rejected";
type SortKey =
  | "queue-age-desc"
  | "submitted-desc"
  | "submitted-asc"
  | "last-review-desc"
  | "name-asc";
type AssignmentFilter = "all" | "mine" | "assigned" | "unassigned";

const FILTERS: Array<{ value: FilterKey; statuses: ProjectStatus[] }> = [
  { value: "pending", statuses: ["in-review"] },
  { value: "approved", statuses: ["shipped", "granted"] },
  { value: "rejected", statuses: ["work-in-progress"] },
];

const SORT_OPTIONS: SortKey[] = [
  "queue-age-desc",
  "submitted-desc",
  "submitted-asc",
  "last-review-desc",
  "name-asc",
];

const ASSIGNMENT_OPTIONS: AssignmentFilter[] = ["all", "mine", "assigned", "unassigned"];

function sortableTimestamp(iso: string | null, fallbackIso: string) {
  const ts = iso ? new Date(iso).getTime() : NaN;
  if (Number.isFinite(ts)) return ts;
  const fallback = new Date(fallbackIso).getTime();
  return Number.isFinite(fallback) ? fallback : 0;
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function GET(req: Request) {
  const session = await getServerSession({ disableCookieCache: true });
  const viewerId = session?.user?.id;
  if (!viewerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: unknown } | undefined)?.role;
  if (!canReview(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const allowedStatus = new Set(FILTERS.map((f) => f.value));
  const activeFilter: FilterKey = allowedStatus.has(statusParam as FilterKey)
    ? (statusParam as FilterKey)
    : "pending";

  const sortParam = searchParams.get("sort");
  const activeSort: SortKey = SORT_OPTIONS.includes(sortParam as SortKey)
    ? (sortParam as SortKey)
    : "queue-age-desc";

  const assignmentParam = searchParams.get("assignment");
  const activeAssignment: AssignmentFilter = ASSIGNMENT_OPTIONS.includes(
    assignmentParam as AssignmentFilter,
  )
    ? (assignmentParam as AssignmentFilter)
    : "all";

  const normalizedCategory = normalizeCategory(searchParams.get("category"));
  const normalizedTag = normalizeTag(searchParams.get("tag"));
  const query = (searchParams.get("q") ?? "").trim().slice(0, 120);

  const activeStatuses = FILTERS.find((f) => f.value === activeFilter)?.statuses ?? ["in-review"];

  const approvedProjectIds =
    activeFilter === "approved"
      ? db
          .select({ projectId: peerReview.projectId })
          .from(peerReview)
          .where(eq(peerReview.decision, "approved"))
      : null;

  const statusConditions = activeStatuses.map((status) => eq(project.status, status));
  const statusWhere = (
    statusConditions.length === 1
      ? statusConditions[0]
      : or(...statusConditions)
  ) as SQL;

  const baseFilterWhere = (
    activeFilter === "approved" && approvedProjectIds
      ? or(statusWhere, inArray(project.id, approvedProjectIds))
      : statusWhere
  ) as SQL;

  const taxonomyRows = await db
    .select({
      category: project.category,
      tags: project.tags,
    })
    .from(project)
    .where(baseFilterWhere);

  const whereParts: SQL[] = [baseFilterWhere];

  if (query) {
    const pattern = `%${escapeLikePattern(query)}%`;
    whereParts.push(
      or(ilike(project.name, pattern), ilike(project.description, pattern), ilike(user.name, pattern)) as SQL,
    );
  }

  if (normalizedCategory) {
    whereParts.push(eq(project.category, normalizedCategory));
  }

  if (normalizedTag) {
    whereParts.push(sql`${project.tags} @> ARRAY[${normalizedTag}]::text[]`);
  }

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
      creatorName: user.name,
    })
    .from(project)
    .leftJoin(user, eq(project.creatorId, user.id))
    .where(whereParts.length === 1 ? whereParts[0]! : and(...whereParts))
    .orderBy(desc(project.submittedAt), desc(project.createdAt));

  const projectIds = rows.map((row) => row.id);

  const assignmentRows =
    projectIds.length === 0
      ? []
      : await db
          .select({
            projectId: projectReviewerAssignment.projectId,
            reviewerId: projectReviewerAssignment.reviewerId,
            reviewerName: user.name,
            reviewerEmail: user.email,
            createdAt: projectReviewerAssignment.createdAt,
          })
          .from(projectReviewerAssignment)
          .leftJoin(user, eq(projectReviewerAssignment.reviewerId, user.id))
          .where(inArray(projectReviewerAssignment.projectId, projectIds))
          .orderBy(
            asc(projectReviewerAssignment.projectId),
            desc(projectReviewerAssignment.createdAt),
            asc(projectReviewerAssignment.reviewerId),
          );

  const reviewRows =
    projectIds.length === 0
      ? []
      : await db
          .select({
            projectId: peerReview.projectId,
            decision: peerReview.decision,
            approvedHours: peerReview.approvedHours,
            createdAt: peerReview.createdAt,
            reviewerName: user.name,
          })
          .from(peerReview)
          .leftJoin(user, eq(peerReview.reviewerId, user.id))
          .where(inArray(peerReview.projectId, projectIds))
          .orderBy(desc(peerReview.createdAt), desc(peerReview.id));

  const assignmentsByProject = new Map<
    string,
    Array<{
      reviewerId: string;
      reviewerName: string;
      reviewerEmail: string;
      createdAt: string;
    }>
  >();

  for (const assignment of assignmentRows) {
    const list = assignmentsByProject.get(assignment.projectId) ?? [];
    list.push({
      reviewerId: assignment.reviewerId,
      reviewerName: assignment.reviewerName || "Unknown reviewer",
      reviewerEmail: assignment.reviewerEmail || "",
      createdAt: assignment.createdAt.toISOString(),
    });
    assignmentsByProject.set(assignment.projectId, list);
  }

  const latestReviewByProject = new Map<
    string,
    {
      decision: string;
      approvedHours: number | null;
      createdAt: string;
      reviewerName: string;
    }
  >();

  for (const row of reviewRows) {
    if (latestReviewByProject.has(row.projectId)) continue;
    latestReviewByProject.set(row.projectId, {
      decision: row.decision,
      approvedHours: row.approvedHours ?? null,
      createdAt: row.createdAt.toISOString(),
      reviewerName: row.reviewerName || "Unknown reviewer",
    });
  }

  const enriched = rows.map((row) => {
    const assignments = assignmentsByProject.get(row.id) ?? [];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      tags: row.tags ?? [],
      editor: row.editor,
      editorOther: row.editorOther,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
      creatorName: row.creatorName,
      assignments,
      assignmentCount: assignments.length,
      isAssignedToMe: assignments.some((assignment) => assignment.reviewerId === viewerId),
      latestReview: latestReviewByProject.get(row.id) ?? null,
    };
  });

  const assignmentFiltered = enriched.filter((projectRow) => {
    if (activeAssignment === "mine") return projectRow.isAssignedToMe;
    if (activeAssignment === "assigned") return projectRow.assignmentCount > 0;
    if (activeAssignment === "unassigned") return projectRow.assignmentCount === 0;
    return true;
  });

  assignmentFiltered.sort((a, b) => {
    if (activeSort === "name-asc") {
      return a.name.localeCompare(b.name);
    }

    if (activeSort === "last-review-desc") {
      const aLast = a.latestReview ? new Date(a.latestReview.createdAt).getTime() : 0;
      const bLast = b.latestReview ? new Date(b.latestReview.createdAt).getTime() : 0;
      if (bLast !== aLast) return bLast - aLast;
      const aSubmitted = sortableTimestamp(a.submittedAt, a.createdAt);
      const bSubmitted = sortableTimestamp(b.submittedAt, b.createdAt);
      return bSubmitted - aSubmitted;
    }

    const aSubmitted = sortableTimestamp(a.submittedAt, a.createdAt);
    const bSubmitted = sortableTimestamp(b.submittedAt, b.createdAt);

    if (activeSort === "submitted-asc") return aSubmitted - bSubmitted;
    if (activeSort === "submitted-desc") return bSubmitted - aSubmitted;
    return aSubmitted - bSubmitted;
  });

  return NextResponse.json({
    projects: assignmentFiltered,
    filters: {
      categories: buildCategorySuggestions(taxonomyRows.map((row) => row.category)),
      tags: buildTagSuggestions(taxonomyRows.map((row) => row.tags)),
      active: {
        status: activeFilter,
        sort: activeSort,
        assignment: activeAssignment,
        category: normalizedCategory,
        tag: normalizedTag,
        q: query,
      },
    },
  });
}

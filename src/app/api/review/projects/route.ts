import { NextResponse } from "next/server";
import { desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { peerReview, project, user, type ProjectStatus, type UserRole } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

function canReview(role: unknown) {
  return role === "reviewer" || role === "admin";
}

type FilterKey = "pending" | "approved" | "rejected";

const FILTERS: Array<{ value: FilterKey; statuses: ProjectStatus[] }> = [
  { value: "pending", statuses: ["in-review"] },
  { value: "approved", statuses: ["shipped", "granted"] },
  { value: "rejected", statuses: ["work-in-progress"] },
];

export async function GET(req: Request) {
  const session = await getServerSession({ disableCookieCache: true });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: unknown } | undefined)?.role;
  if (!canReview(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const allowed = new Set(FILTERS.map((f) => f.value));
  const activeFilter: FilterKey = allowed.has(statusParam as FilterKey)
    ? (statusParam as FilterKey)
    : "pending";

  const activeStatuses = FILTERS.find((f) => f.value === activeFilter)?.statuses ?? ["in-review"];

  const approvedProjectIds =
    activeFilter === "approved"
      ? db
          .select({ projectId: peerReview.projectId })
          .from(peerReview)
          .where(eq(peerReview.decision, "approved"))
      : null;

  const statusConditions = activeStatuses.map((status) => eq(project.status, status));
  const statusWhere =
    statusConditions.length === 1
      ? statusConditions[0]
      : or(...statusConditions);

  const rows = await db
    .select({
      id: project.id,
      name: project.name,
      description: project.description,
      editor: project.editor,
      editorOther: project.editorOther,
      status: project.status,
      createdAt: project.createdAt,
      submittedAt: project.submittedAt,
      creatorName: user.name,
    })
    .from(project)
    .leftJoin(user, eq(project.creatorId, user.id))
    .where(
      activeFilter === "approved" && approvedProjectIds
        ? or(statusWhere, inArray(project.id, approvedProjectIds))
        : statusWhere,
    )
    .orderBy(desc(project.submittedAt), desc(project.createdAt));

  return NextResponse.json({ projects: rows });
}

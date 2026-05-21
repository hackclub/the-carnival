import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { project } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

export type ProjectAccess = {
  userId: string;
  role: unknown;
  project: { id: string; creatorId: string | null; hackatimeProjectName: string };
};

/**
 * Resolve the current session and load the target project. Returns a ready-to-send
 * 401/404 response when the user is unauthenticated or the project is missing;
 * otherwise returns the session identity and the project row. Callers apply their
 * own creator/role authorization on the returned values.
 */
export async function resolveProjectAccess(
  projectId: string,
): Promise<{ error: NextResponse } | ProjectAccess> {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const rows = await db
    .select({
      id: project.id,
      creatorId: project.creatorId,
      hackatimeProjectName: project.hackatimeProjectName,
    })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return { error: NextResponse.json({ error: "Project not found" }, { status: 404 }) };
  }

  const role = (session?.user as { role?: unknown } | undefined)?.role;
  return { userId, role, project: row };
}

export function canReadProject(role: unknown, isCreator: boolean) {
  return isCreator || role === "reviewer" || role === "admin";
}

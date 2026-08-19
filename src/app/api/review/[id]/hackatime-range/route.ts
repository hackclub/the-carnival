import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { project, type UserRole } from "@/db/schema";
import { listProjectHackatimeProjects } from "@/lib/devlogs";
import { fetchHackatimeProjectTotalSecondsForInstantRange } from "@/lib/hackatime";
import { getServerSession } from "@/lib/server-session";

/**
 * Reviewer tool: how much Hackatime time did the creator log for this
 * project's linked Hackatime project(s) within an arbitrary window?
 *
 * Used in two places:
 *  - the "Check a custom window" tool on the review page, and
 *  - the per-devlog reviewed-window override in the assessment panel (the
 *    reviewer pulls the trimmed window's hours before applying it).
 *
 * Read-only: nothing is stored. The same timeline-based fetch that devlogs
 * use to capture their hours is used here, so the numbers always line up.
 */

function canReview(role: unknown): role is Extract<UserRole, "reviewer" | "admin"> {
  return role === "reviewer" || role === "admin";
}

function toDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const MAX_WINDOW_MS = 366 * 24 * 60 * 60 * 1000;
const MAX_PROJECTS_QUERIED = 10;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canReview(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: projectId } = await ctx.params;

  const body = (await req.json().catch(() => null)) as
    | { startedAt?: unknown; endedAt?: unknown; hackatimeProjectName?: unknown }
    | null;
  const startedAt = toDate(body?.startedAt);
  const endedAt = toDate(body?.endedAt);
  if (!startedAt || !endedAt) {
    return NextResponse.json(
      { error: "startedAt and endedAt must be valid timestamps." },
      { status: 400 },
    );
  }
  if (endedAt.getTime() <= startedAt.getTime()) {
    return NextResponse.json({ error: "The window end must be after its start." }, { status: 400 });
  }
  if (endedAt.getTime() - startedAt.getTime() > MAX_WINDOW_MS) {
    return NextResponse.json({ error: "The window can span at most one year." }, { status: 400 });
  }

  const rows = await db
    .select({
      creatorId: project.creatorId,
      hackatimeProjectName: project.hackatimeProjectName,
    })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);
  const current = rows[0];
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!current.creatorId) {
    return NextResponse.json({ error: "Project has no creator." }, { status: 409 });
  }

  // Which Hackatime projects to query: the explicit one from the body, or all
  // linked projects (falling back to the project's default name).
  const requestedName =
    typeof body?.hackatimeProjectName === "string" ? body.hackatimeProjectName.trim() : "";
  let names: string[];
  if (requestedName) {
    names = [requestedName];
  } else {
    const linked = await listProjectHackatimeProjects(projectId);
    names = linked.length > 0 ? linked.map((lp) => lp.name) : [];
    if (names.length === 0 && current.hackatimeProjectName.trim()) {
      names = [current.hackatimeProjectName.trim()];
    }
  }
  if (names.length === 0) {
    return NextResponse.json(
      { error: "No Hackatime project is linked to this project." },
      { status: 400 },
    );
  }
  names = names.slice(0, MAX_PROJECTS_QUERIED);

  try {
    const projects = await Promise.all(
      names.map(async (name) => {
        const { totalSeconds } = await fetchHackatimeProjectTotalSecondsForInstantRange(
          current.creatorId as string,
          { projectName: name, startedAt, endedAt },
        );
        return { name, seconds: Math.max(0, Math.floor(totalSeconds || 0)) };
      }),
    );
    const totalSeconds = projects.reduce((acc, p) => acc + p.seconds, 0);
    return NextResponse.json({
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      projects,
      totalSeconds,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Failed to fetch Hackatime for the window.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { project } from "@/db/schema";
import { computeWindowCeiling, parseDevlogWindow } from "@/lib/devlog-shared";
import { getDevlogWindowFloor } from "@/lib/devlogs";
import { fetchHackatimeProjectTotalSecondsForInstantRange } from "@/lib/hackatime";
import { getServerSession } from "@/lib/server-session";

/**
 * GET /api/projects/[id]/devlogs/preview?startedAt=...&endedAt=...
 * Preview the Hackatime seconds that would be recorded for a devlog window. Only
 * the project creator can hit this; used to power the live duration indicator on
 * the new-devlog form.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await ctx.params;
  const rows = await db
    .select({
      id: project.id,
      creatorId: project.creatorId,
      status: project.status,
      hackatimeProjectName: project.hackatimeProjectName,
      submittedAt: project.submittedAt,
      startedOnCarnivalAt: project.startedOnCarnivalAt,
      createdAt: project.createdAt,
    })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);

  const p = rows[0];
  if (!p) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (p.creatorId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const startedAtRaw = url.searchParams.get("startedAt");
  const endedAtRaw = url.searchParams.get("endedAt");

  const floorBase = p.startedOnCarnivalAt ?? p.createdAt;
  const floor = await getDevlogWindowFloor(projectId, floorBase);
  const ceiling = computeWindowCeiling(p.submittedAt ?? null);

  if (!startedAtRaw || !endedAtRaw) {
    return NextResponse.json({
      floor: floor.toISOString(),
      ceiling: ceiling.toISOString(),
      durationSeconds: null,
    });
  }

  const window = parseDevlogWindow({
    startedAt: startedAtRaw,
    endedAt: endedAtRaw,
    floor,
    ceiling,
  });
  if (!window.ok) {
    return NextResponse.json(
      {
        floor: floor.toISOString(),
        ceiling: ceiling.toISOString(),
        durationSeconds: null,
        error: window.error,
      },
      { status: 400 },
    );
  }

  const hackatimeProjectName = (p.hackatimeProjectName ?? "").trim();
  if (!hackatimeProjectName) {
    return NextResponse.json(
      {
        floor: floor.toISOString(),
        ceiling: ceiling.toISOString(),
        durationSeconds: null,
        error: "Set a Hackatime project name on the project before posting devlogs.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await fetchHackatimeProjectTotalSecondsForInstantRange(userId, {
      projectName: hackatimeProjectName,
      startedAt: window.startedAt,
      endedAt: window.endedAt,
    });
    return NextResponse.json({
      floor: floor.toISOString(),
      ceiling: ceiling.toISOString(),
      durationSeconds: Math.max(0, Math.floor(result.totalSeconds)),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to pull Hackatime hours.";
    return NextResponse.json(
      {
        floor: floor.toISOString(),
        ceiling: ceiling.toISOString(),
        durationSeconds: null,
        error: message,
      },
      { status: 400 },
    );
  }
}

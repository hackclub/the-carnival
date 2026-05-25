import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { devlog, project, user } from "@/db/schema";
import { recomputeProjectHoursSpentSeconds } from "@/lib/devlogs";
import { fetchHackatimeProjectTotalSecondsForInstantRange } from "@/lib/hackatime";
import { getServerSession } from "@/lib/server-session";

function canRefresh(role: unknown) {
  return role === "reviewer" || role === "admin";
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string; devlogId: string }> },
) {
  const session = await getServerSession();
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canRefresh(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: projectId, devlogId } = await ctx.params;
  const rows = await db
    .select({
      id: devlog.id,
      projectId: devlog.projectId,
      userId: devlog.userId,
      title: devlog.title,
      content: devlog.content,
      startedAt: devlog.startedAt,
      endedAt: devlog.endedAt,
      attachments: devlog.attachments,
      usedAi: devlog.usedAi,
      aiUsageDescription: devlog.aiUsageDescription,
      hackatimeProjectNameSnapshot: devlog.hackatimeProjectNameSnapshot,
      createdAt: devlog.createdAt,
      authorName: user.name,
      projectIdFromProject: project.id,
    })
    .from(devlog)
    .leftJoin(user, eq(devlog.userId, user.id))
    .leftJoin(project, eq(devlog.projectId, project.id))
    .where(and(eq(devlog.id, devlogId), eq(devlog.projectId, projectId)))
    .limit(1);

  const row = rows[0];
  if (!row || !row.projectIdFromProject) {
    return NextResponse.json({ error: "Devlog not found" }, { status: 404 });
  }

  const hackatimeProjectName = (row.hackatimeProjectNameSnapshot ?? "").trim();
  if (!hackatimeProjectName) {
    return NextResponse.json(
      { error: "This devlog does not have a Hackatime project to refresh." },
      { status: 400 },
    );
  }

  let durationSeconds = 0;
  try {
    const refreshed = await fetchHackatimeProjectTotalSecondsForInstantRange(row.userId, {
      projectName: hackatimeProjectName,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
    });
    durationSeconds = Math.max(0, Math.floor(refreshed.totalSeconds));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to refresh Hackatime hours.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(devlog)
      .set({
        durationSeconds,
        hackatimePulledAt: now,
        updatedAt: now,
      })
      .where(and(eq(devlog.id, devlogId), eq(devlog.projectId, projectId)));
    await recomputeProjectHoursSpentSeconds(projectId, tx);
  });

  return NextResponse.json({
    devlog: {
      id: row.id,
      projectId: row.projectId,
      userId: row.userId,
      title: row.title,
      content: row.content,
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt.toISOString(),
      durationSeconds,
      attachments: row.attachments ?? [],
      usedAi: row.usedAi,
      aiUsageDescription: row.aiUsageDescription ?? null,
      hackatimeProjectNameSnapshot: hackatimeProjectName,
      authorName: row.authorName || "Unknown",
      createdAt: row.createdAt.toISOString(),
      updatedAt: now.toISOString(),
    },
  });
}

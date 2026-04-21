import { NextResponse } from "next/server";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { devlog, project, user } from "@/db/schema";
import {
  DEVLOG_AI_DESCRIPTION_MAX_LENGTH,
  DEVLOG_MAX_CONTENT_LENGTH,
  DEVLOG_MAX_TITLE_LENGTH,
  computeWindowCeiling,
  getDevlogWindowFloor,
  parseAttachmentUrls,
  parseDevlogWindow,
  parseOptionalTrimmedString,
  recomputeProjectHoursSpentSeconds,
} from "@/lib/devlogs";
import { getFrozenAccountMessage, getFrozenAccountState } from "@/lib/frozen-account";
import { fetchHackatimeProjectTotalSecondsForInstantRange } from "@/lib/hackatime";
import { getServerSession } from "@/lib/server-session";

type UpdateDevlogBody = {
  title?: unknown;
  content?: unknown;
  startedAt?: unknown;
  endedAt?: unknown;
  attachments?: unknown;
  usedAi?: unknown;
  aiUsageDescription?: unknown;
};

function toCleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function canViewProjectDevlogs(role: unknown, isCreator: boolean) {
  if (isCreator) return true;
  return role === "reviewer" || role === "admin";
}

async function loadDevlog(projectId: string, devlogId: string) {
  const rows = await db
    .select({
      id: devlog.id,
      projectId: devlog.projectId,
      userId: devlog.userId,
      title: devlog.title,
      content: devlog.content,
      startedAt: devlog.startedAt,
      endedAt: devlog.endedAt,
      durationSeconds: devlog.durationSeconds,
      attachments: devlog.attachments,
      usedAi: devlog.usedAi,
      aiUsageDescription: devlog.aiUsageDescription,
      hackatimeProjectNameSnapshot: devlog.hackatimeProjectNameSnapshot,
      createdAt: devlog.createdAt,
      updatedAt: devlog.updatedAt,
      authorName: user.name,
      projectCreatorId: project.creatorId,
      projectStatus: project.status,
      projectHackatimeProjectName: project.hackatimeProjectName,
      projectSubmittedAt: project.submittedAt,
      projectStartedOnCarnivalAt: project.startedOnCarnivalAt,
      projectCreatedAt: project.createdAt,
    })
    .from(devlog)
    .leftJoin(user, eq(devlog.userId, user.id))
    .leftJoin(project, eq(devlog.projectId, project.id))
    .where(and(eq(devlog.id, devlogId), eq(devlog.projectId, projectId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; devlogId: string }> },
) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, devlogId } = await ctx.params;
  const row = await loadDevlog(projectId, devlogId);
  if (!row) {
    return NextResponse.json({ error: "Devlog not found" }, { status: 404 });
  }

  const role = (session?.user as { role?: unknown } | undefined)?.role;
  const isCreator = row.projectCreatorId === userId;
  if (!canViewProjectDevlogs(role, isCreator)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    devlog: {
      id: row.id,
      projectId: row.projectId,
      userId: row.userId,
      title: row.title,
      content: row.content,
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt.toISOString(),
      durationSeconds: row.durationSeconds,
      attachments: row.attachments ?? [],
      usedAi: row.usedAi,
      aiUsageDescription: row.aiUsageDescription ?? null,
      hackatimeProjectNameSnapshot: row.hackatimeProjectNameSnapshot ?? "",
      authorName: row.authorName || "Unknown",
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; devlogId: string }> },
) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const freezeState = await getFrozenAccountState(userId);
  if (freezeState.isFrozen) {
    return NextResponse.json(
      {
        error: getFrozenAccountMessage(freezeState.frozenReason),
        code: "account_frozen",
      },
      { status: 403 },
    );
  }

  const { id: projectId, devlogId } = await ctx.params;
  const row = await loadDevlog(projectId, devlogId);
  if (!row) {
    return NextResponse.json({ error: "Devlog not found" }, { status: 404 });
  }

  if (row.userId !== userId) {
    return NextResponse.json(
      { error: "Only the author can edit this devlog." },
      { status: 403 },
    );
  }
  if (row.projectStatus !== "work-in-progress" || row.projectSubmittedAt) {
    return NextResponse.json(
      {
        error: "Devlogs are frozen once the project is submitted for review.",
        code: "devlog_frozen",
      },
      { status: 409 },
    );
  }

  let body: UpdateDevlogBody;
  try {
    body = (await req.json()) as UpdateDevlogBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const set: Partial<{
    title: string;
    content: string;
    startedAt: Date;
    endedAt: Date;
    durationSeconds: number;
    attachments: string[];
    usedAi: boolean;
    aiUsageDescription: string | null;
    hackatimePulledAt: Date;
    updatedAt: Date;
  }> = {};
  let hoursChanged = false;

  if (body.title !== undefined) {
    const title = toCleanString(body.title);
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (title.length > DEVLOG_MAX_TITLE_LENGTH) {
      return NextResponse.json(
        { error: `Title must be ${DEVLOG_MAX_TITLE_LENGTH} characters or less` },
        { status: 400 },
      );
    }
    set.title = title;
  }

  if (body.content !== undefined) {
    const content = toCleanString(body.content);
    if (!content) return NextResponse.json({ error: "Content is required" }, { status: 400 });
    if (content.length > DEVLOG_MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `Content must be ${DEVLOG_MAX_CONTENT_LENGTH} characters or less` },
        { status: 400 },
      );
    }
    set.content = content;
  }

  if (body.attachments !== undefined) {
    const parsed = parseAttachmentUrls(body.attachments, { projectId });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    set.attachments = parsed.value;
  }

  let usedAi = row.usedAi;
  let aiUsageDescription: string | null = row.aiUsageDescription ?? null;
  if (body.usedAi !== undefined) {
    if (typeof body.usedAi !== "boolean") {
      return NextResponse.json({ error: "usedAi must be a boolean." }, { status: 400 });
    }
    usedAi = body.usedAi;
  }
  if (body.aiUsageDescription !== undefined) {
    const parsed = parseOptionalTrimmedString(
      body.aiUsageDescription,
      DEVLOG_AI_DESCRIPTION_MAX_LENGTH,
    );
    if (parsed === undefined) {
      return NextResponse.json(
        { error: `AI usage description is too long (max ${DEVLOG_AI_DESCRIPTION_MAX_LENGTH} characters).` },
        { status: 400 },
      );
    }
    aiUsageDescription = parsed;
  }
  if (usedAi && !aiUsageDescription) {
    return NextResponse.json(
      { error: "Describe how you used AI when checking the AI declaration." },
      { status: 400 },
    );
  }
  if (body.usedAi !== undefined || body.aiUsageDescription !== undefined) {
    set.usedAi = usedAi;
    set.aiUsageDescription = usedAi ? aiUsageDescription : null;
  }

  if (body.startedAt !== undefined || body.endedAt !== undefined) {
    const laterRows = await db
      .select({ id: devlog.id })
      .from(devlog)
      .where(and(eq(devlog.projectId, projectId), gt(devlog.endedAt, row.endedAt)))
      .limit(1);
    if (laterRows.length > 0) {
      return NextResponse.json(
        {
          error:
            "You can only change the window on the latest devlog. Delete newer devlogs first or edit them instead.",
        },
        { status: 400 },
      );
    }

    const floorBase = row.projectStartedOnCarnivalAt ?? row.projectCreatedAt ?? row.createdAt;
    const floor = await getDevlogWindowFloor(projectId, floorBase, row.id);
    const ceiling = computeWindowCeiling(row.projectSubmittedAt ?? null);

    const window = parseDevlogWindow({
      startedAt: body.startedAt ?? row.startedAt.toISOString(),
      endedAt: body.endedAt ?? row.endedAt.toISOString(),
      floor,
      ceiling,
    });
    if (!window.ok) return NextResponse.json({ error: window.error }, { status: 400 });

    const hackatimeProjectName = (row.projectHackatimeProjectName ?? "").trim();
    if (!hackatimeProjectName) {
      return NextResponse.json(
        { error: "Hackatime project name is missing on the parent project." },
        { status: 400 },
      );
    }

    try {
      const hackatime = await fetchHackatimeProjectTotalSecondsForInstantRange(userId, {
        projectName: hackatimeProjectName,
        startedAt: window.startedAt,
        endedAt: window.endedAt,
      });
      set.startedAt = window.startedAt;
      set.endedAt = window.endedAt;
      set.durationSeconds = Math.max(0, Math.floor(hackatime.totalSeconds));
      set.hackatimePulledAt = new Date();
      hoursChanged = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to pull Hackatime hours.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  set.updatedAt = new Date();

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(devlog)
        .set(set)
        .where(and(eq(devlog.id, devlogId), eq(devlog.userId, userId)));
      if (hoursChanged) {
        await recomputeProjectHoursSpentSeconds(projectId, tx);
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update devlog.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const updated = await loadDevlog(projectId, devlogId);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    devlog: {
      id: updated.id,
      projectId: updated.projectId,
      userId: updated.userId,
      title: updated.title,
      content: updated.content,
      startedAt: updated.startedAt.toISOString(),
      endedAt: updated.endedAt.toISOString(),
      durationSeconds: updated.durationSeconds,
      attachments: updated.attachments ?? [],
      usedAi: updated.usedAi,
      aiUsageDescription: updated.aiUsageDescription ?? null,
      hackatimeProjectNameSnapshot: updated.hackatimeProjectNameSnapshot ?? "",
      authorName: updated.authorName || "Unknown",
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; devlogId: string }> },
) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, devlogId } = await ctx.params;
  const row = await loadDevlog(projectId, devlogId);
  if (!row) {
    return NextResponse.json({ error: "Devlog not found" }, { status: 404 });
  }

  const role = (session?.user as { role?: unknown } | undefined)?.role;
  const isAuthor = row.userId === userId;
  const isAdmin = role === "admin";

  if (!isAuthor && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (isAuthor && !isAdmin) {
    if (row.projectStatus !== "work-in-progress" || row.projectSubmittedAt) {
      return NextResponse.json(
        {
          error: "Devlogs are frozen once the project is submitted for review.",
          code: "devlog_frozen",
        },
        { status: 409 },
      );
    }
  }

  try {
    await db.transaction(async (tx) => {
      await tx.delete(devlog).where(eq(devlog.id, devlogId));
      await recomputeProjectHoursSpentSeconds(projectId, tx);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete devlog.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// Keep desc import even though not used directly — helps typed builders.
void desc;

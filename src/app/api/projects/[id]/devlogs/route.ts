import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { devlog, project, user, type DevlogCategory } from "@/db/schema";
import {
  DEVLOG_AI_DESCRIPTION_MAX_LENGTH,
  DEVLOG_MAX_CONTENT_LENGTH,
  DEVLOG_MAX_TITLE_LENGTH,
  computeDevlogWindowCeiling,
  parseAttachmentUrls,
  parseDevlogWindow,
  parseOptionalTrimmedString,
} from "@/lib/devlog-shared";
import {
  countProjectDevlogs,
  getDevlogWindowFloor,
  recomputeProjectHoursSpentSeconds,
  resolveDevlogHackatimeProjectName,
  upsertProjectHackatimeProject,
} from "@/lib/devlogs";
import { getFrozenAccountMessage, getFrozenAccountState } from "@/lib/frozen-account";
import { fetchHackatimeProjectTotalSecondsForInstantRange } from "@/lib/hackatime";
import { getServerSession } from "@/lib/server-session";

type CreateDevlogBody = {
  title?: unknown;
  content?: unknown;
  category?: unknown;
  hackatimeProjectName?: unknown;
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

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await ctx.params;

  const projectRows = await db
    .select({ id: project.id, creatorId: project.creatorId })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);

  const p = projectRows[0];
  if (!p) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const role = (session?.user as { role?: unknown } | undefined)?.role;
  const isCreator = p.creatorId === userId;
  if (!canViewProjectDevlogs(role, isCreator)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db
    .select({
      id: devlog.id,
      projectId: devlog.projectId,
      userId: devlog.userId,
      title: devlog.title,
      content: devlog.content,
      category: devlog.category,
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
    })
    .from(devlog)
    .leftJoin(user, eq(devlog.userId, user.id))
    .where(eq(devlog.projectId, projectId))
    .orderBy(desc(devlog.endedAt), asc(devlog.id));

  return NextResponse.json({
    devlogs: rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      userId: r.userId,
      title: r.title,
      content: r.content,
      category: r.category ?? "coding",
      startedAt: r.startedAt.toISOString(),
      endedAt: r.endedAt.toISOString(),
      durationSeconds: r.durationSeconds,
      attachments: r.attachments ?? [],
      usedAi: r.usedAi,
      aiUsageDescription: r.aiUsageDescription ?? null,
      hackatimeProjectNameSnapshot: r.hackatimeProjectNameSnapshot ?? "",
      authorName: r.authorName || "Unknown",
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const { id: projectId } = await ctx.params;

  const projectRows = await db
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

  const p = projectRows[0];
  if (!p) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (p.creatorId !== userId) {
    return NextResponse.json(
      { error: "Only the project creator can add devlogs." },
      { status: 403 },
    );
  }
  if (p.status !== "work-in-progress") {
    return NextResponse.json(
      {
        error: "Devlogs can only be posted while the project is work-in-progress.",
        code: "project_not_editable",
      },
      { status: 409 },
    );
  }
  let body: CreateDevlogBody;
  try {
    body = (await req.json()) as CreateDevlogBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = toCleanString(body.title);
  const content = toCleanString(body.content);
  const VALID_DEVLOG_CATEGORIES: DevlogCategory[] = ["learning", "design", "coding"];
  const categoryRaw = typeof body.category === "string" ? body.category.trim() : "coding";
  const category: DevlogCategory = VALID_DEVLOG_CATEGORIES.includes(categoryRaw as DevlogCategory)
    ? (categoryRaw as DevlogCategory)
    : "coding";

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (title.length > DEVLOG_MAX_TITLE_LENGTH) {
    return NextResponse.json(
      { error: `Title must be ${DEVLOG_MAX_TITLE_LENGTH} characters or less` },
      { status: 400 },
    );
  }
  if (!content) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }
  if (content.length > DEVLOG_MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `Content must be ${DEVLOG_MAX_CONTENT_LENGTH} characters or less` },
      { status: 400 },
    );
  }

  const attachments = parseAttachmentUrls(body.attachments, { projectId });
  if (!attachments.ok) {
    return NextResponse.json({ error: attachments.error }, { status: 400 });
  }

  if (body.usedAi !== undefined && typeof body.usedAi !== "boolean") {
    return NextResponse.json({ error: "usedAi must be a boolean." }, { status: 400 });
  }
  const usedAi = body.usedAi === true;

  const aiDescParsed = parseOptionalTrimmedString(
    body.aiUsageDescription,
    DEVLOG_AI_DESCRIPTION_MAX_LENGTH,
  );
  if (aiDescParsed === undefined) {
    return NextResponse.json(
      {
        error: `AI usage description is too long (max ${DEVLOG_AI_DESCRIPTION_MAX_LENGTH} characters).`,
      },
      { status: 400 },
    );
  }
  if (usedAi && !aiDescParsed) {
    return NextResponse.json(
      { error: "Describe how you used AI when checking the AI declaration." },
      { status: 400 },
    );
  }
  const aiUsageDescription = usedAi ? aiDescParsed : null;

  const floorStart = p.startedOnCarnivalAt ?? p.createdAt;
  const floor = await getDevlogWindowFloor(projectId, floorStart);
  const ceiling = computeDevlogWindowCeiling({
    projectStatus: p.status,
    submittedAt: p.submittedAt ?? null,
  });
  const priorDevlogCount = await countProjectDevlogs(projectId);
  let hackatimeProjectName = "";
  try {
    hackatimeProjectName = resolveDevlogHackatimeProjectName({
      requestedName: body.hackatimeProjectName,
      defaultName: p.hackatimeProjectName,
      hasPriorDevlogs: priorDevlogCount > 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Select a Hackatime project.";
    return NextResponse.json(
      { error: message, code: "missing_hackatime_project" },
      { status: 400 },
    );
  }

  const window = parseDevlogWindow({
    startedAt: body.startedAt,
    endedAt: body.endedAt,
    floor,
    ceiling,
  });
  if (!window.ok) {
    return NextResponse.json({ error: window.error }, { status: 400 });
  }

  let durationSeconds = 0;
  try {
    const hackatime = await fetchHackatimeProjectTotalSecondsForInstantRange(userId, {
      projectName: hackatimeProjectName,
      startedAt: window.startedAt,
      endedAt: window.endedAt,
    });
    durationSeconds = Math.max(0, Math.floor(hackatime.totalSeconds));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to pull Hackatime hours.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const now = new Date();
  const devlogId = randomUUID();

  try {
    await db.transaction(async (tx) => {
      await tx.insert(devlog).values({
        id: devlogId,
        projectId,
        userId,
        title,
        content,
        category,
        startedAt: window.startedAt,
        endedAt: window.endedAt,
        durationSeconds,
        attachments: attachments.value,
        usedAi,
        aiUsageDescription,
        hackatimeProjectNameSnapshot: hackatimeProjectName,
        hackatimePulledAt: now,
        createdAt: now,
        updatedAt: now,
      });
      await upsertProjectHackatimeProject(
        {
          projectId,
          name: hackatimeProjectName,
          firstDevlogId: devlogId,
          makeDefault: priorDevlogCount === 0,
        },
        tx,
      );
      await recomputeProjectHoursSpentSeconds(projectId, tx);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save devlog.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json(
    {
      devlog: {
        id: devlogId,
        projectId,
        userId,
        title,
        content,
        category,
        startedAt: window.startedAt.toISOString(),
        endedAt: window.endedAt.toISOString(),
        durationSeconds,
        attachments: attachments.value,
        usedAi,
        aiUsageDescription,
        hackatimeProjectNameSnapshot: hackatimeProjectName,
        authorName: (session?.user as { name?: string | null } | undefined)?.name ?? "",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    },
    { status: 201 },
  );
}

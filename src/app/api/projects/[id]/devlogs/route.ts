import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { devlog, project, user } from "@/db/schema";
import { getFrozenAccountMessage, getFrozenAccountState } from "@/lib/frozen-account";
import { getServerSession } from "@/lib/server-session";

type CreateDevlogBody = {
  title?: unknown;
  content?: unknown;
};

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 20_000;

function toCleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function canViewProjectDevlogs(role: unknown, isCreator: boolean) {
  if (isCreator) return true;
  return role === "reviewer" || role === "admin";
}

/**
 * GET /api/projects/[id]/devlogs
 * List devlogs for a project. Visible to the creator, reviewers, and admins.
 */
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
      createdAt: devlog.createdAt,
      updatedAt: devlog.updatedAt,
      authorName: user.name,
    })
    .from(devlog)
    .leftJoin(user, eq(devlog.userId, user.id))
    .where(eq(devlog.projectId, projectId))
    .orderBy(desc(devlog.createdAt), asc(devlog.id));

  return NextResponse.json({
    devlogs: rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      userId: r.userId,
      title: r.title,
      content: r.content,
      authorName: r.authorName || "Unknown",
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
}

/**
 * POST /api/projects/[id]/devlogs
 * Create a new devlog entry. Only the project creator may post devlogs.
 */
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
    .select({ id: project.id, creatorId: project.creatorId, status: project.status })
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

  let body: CreateDevlogBody;
  try {
    body = (await req.json()) as CreateDevlogBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = toCleanString(body.title);
  const content = toCleanString(body.content);

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return NextResponse.json(
      { error: `Title must be ${MAX_TITLE_LENGTH} characters or less` },
      { status: 400 },
    );
  }
  if (!content) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `Content must be ${MAX_CONTENT_LENGTH} characters or less` },
      { status: 400 },
    );
  }

  const now = new Date();
  const id = randomUUID();

  await db.insert(devlog).values({
    id,
    projectId,
    userId,
    title,
    content,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json(
    {
      devlog: {
        id,
        projectId,
        userId,
        title,
        content,
        authorName: (session?.user as { name?: string | null } | undefined)?.name ?? "",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    },
    { status: 201 },
  );
}

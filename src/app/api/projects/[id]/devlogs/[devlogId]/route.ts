import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { devlog, project, user } from "@/db/schema";
import { getFrozenAccountMessage, getFrozenAccountState } from "@/lib/frozen-account";
import { getServerSession } from "@/lib/server-session";

type UpdateDevlogBody = {
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

async function loadDevlog(projectId: string, devlogId: string) {
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
      projectCreatorId: project.creatorId,
    })
    .from(devlog)
    .leftJoin(user, eq(devlog.userId, user.id))
    .leftJoin(project, eq(devlog.projectId, project.id))
    .where(and(eq(devlog.id, devlogId), eq(devlog.projectId, projectId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * GET /api/projects/[id]/devlogs/[devlogId]
 * Read a single devlog.
 */
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
      authorName: row.authorName || "Unknown",
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
  });
}

/**
 * PATCH /api/projects/[id]/devlogs/[devlogId]
 * Update a devlog. Only the author can edit.
 */
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

  let body: UpdateDevlogBody;
  try {
    body = (await req.json()) as UpdateDevlogBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const set: Partial<{ title: string; content: string; updatedAt: Date }> = {};

  if (body.title !== undefined) {
    const title = toCleanString(body.title);
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (title.length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        { error: `Title must be ${MAX_TITLE_LENGTH} characters or less` },
        { status: 400 },
      );
    }
    set.title = title;
  }

  if (body.content !== undefined) {
    const content = toCleanString(body.content);
    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `Content must be ${MAX_CONTENT_LENGTH} characters or less` },
        { status: 400 },
      );
    }
    set.content = content;
  }

  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  set.updatedAt = new Date();

  const updated = await db
    .update(devlog)
    .set(set)
    .where(and(eq(devlog.id, devlogId), eq(devlog.userId, userId)))
    .returning({
      id: devlog.id,
      projectId: devlog.projectId,
      userId: devlog.userId,
      title: devlog.title,
      content: devlog.content,
      createdAt: devlog.createdAt,
      updatedAt: devlog.updatedAt,
    });

  const u = updated[0];
  if (!u) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    devlog: {
      id: u.id,
      projectId: u.projectId,
      userId: u.userId,
      title: u.title,
      content: u.content,
      authorName: row.authorName || "Unknown",
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    },
  });
}

/**
 * DELETE /api/projects/[id]/devlogs/[devlogId]
 * Delete a devlog. Only the author can delete. Admins can also delete.
 */
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

  await db.delete(devlog).where(eq(devlog.id, devlogId));

  return NextResponse.json({ ok: true });
}

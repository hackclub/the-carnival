import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { project, type ProjectStatus } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

type AdminProjectPatchBody = {
  status?: unknown;
};

function isAdmin(role: unknown): role is "admin" {
  return role === "admin";
}

function isAdminEditableStatus(value: unknown): value is Extract<ProjectStatus, "shipped" | "granted"> {
  return value === "shipped" || value === "granted";
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;

  let body: AdminProjectPatchBody;
  try {
    body = (await req.json()) as AdminProjectPatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isAdminEditableStatus(body.status)) {
    return NextResponse.json(
      { error: "Invalid status. Allowed: shipped, granted" },
      { status: 400 },
    );
  }

  const now = new Date();
  const updated = await db
    .update(project)
    .set({ status: body.status, updatedAt: now })
    .where(eq(project.id, id))
    .returning({
      id: project.id,
      status: project.status,
      updatedAt: project.updatedAt,
    });

  const p = updated[0];
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ project: p });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;

  const deleted = await db
    .delete(project)
    .where(eq(project.id, id))
    .returning({ id: project.id });

  if (deleted.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}



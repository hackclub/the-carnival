import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { editor, resource } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

type UpdateEditorBody = {
  name?: unknown;
  slug?: unknown;
  description?: unknown;
  iconUrl?: unknown;
};

function toCleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toSlug(value: unknown) {
  const str = toCleanString(value);
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [editorRow] = await db
    .select({
      id: editor.id,
      name: editor.name,
      slug: editor.slug,
      description: editor.description,
      iconUrl: editor.iconUrl,
      createdAt: editor.createdAt,
    })
    .from(editor)
    .where(eq(editor.id, id));

  if (!editorRow) {
    return NextResponse.json({ error: "Editor not found" }, { status: 404 });
  }

  // Also fetch resources for this editor
  const resources = await db
    .select({
      id: resource.id,
      title: resource.title,
      url: resource.url,
      description: resource.description,
      type: resource.type,
      createdAt: resource.createdAt,
    })
    .from(resource)
    .where(eq(resource.editorId, id))
    .orderBy(resource.createdAt);

  return NextResponse.json({ editor: editorRow, resources });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  let body: UpdateEditorBody;
  try {
    body = (await req.json()) as UpdateEditorBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: editor.id })
    .from(editor)
    .where(eq(editor.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Editor not found" }, { status: 404 });
  }

  const updates: Partial<{
    name: string;
    slug: string;
    description: string | null;
    iconUrl: string | null;
    updatedAt: Date;
  }> = { updatedAt: new Date() };

  if (body.name !== undefined) {
    const name = toCleanString(body.name);
    if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    updates.name = name;
  }

  if (body.slug !== undefined) {
    const slug = toSlug(body.slug);
    if (!slug) return NextResponse.json({ error: "Slug cannot be empty" }, { status: 400 });
    updates.slug = slug;
  }

  if (body.description !== undefined) {
    updates.description = toCleanString(body.description) || null;
  }

  if (body.iconUrl !== undefined) {
    updates.iconUrl = toCleanString(body.iconUrl) || null;
  }

  try {
    await db.update(editor).set(updates).where(eq(editor.id, id));
  } catch (err: unknown) {
    // Check for PostgreSQL unique constraint violation (code 23505)
    const pgErr = err as { code?: string; message?: string; cause?: { code?: string } };
    const errorCode = pgErr.code || pgErr.cause?.code;
    const msg = pgErr.message || "";
    
    if (errorCode === "23505" || msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ error: "An editor with this name or slug already exists" }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const [existing] = await db
    .select({ id: editor.id })
    .from(editor)
    .where(eq(editor.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Editor not found" }, { status: 404 });
  }

  await db.delete(editor).where(eq(editor.id, id));

  return NextResponse.json({ success: true });
}


import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { editor, resource } from "@/db/schema";
import {
  getAuthUser,
  parseJsonBody,
  toCleanString,
  toSlug,
  updatedTimestamp,
  isUniqueConstraintError,
} from "@/lib/api-utils";

type UpdateEditorBody = {
  name?: unknown;
  slug?: unknown;
  description?: unknown;
  iconUrl?: unknown;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  if (!editorRow) return NextResponse.json({ error: "Editor not found" }, { status: 404 });

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
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const body = await parseJsonBody<UpdateEditorBody>(req);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const [existing] = await db
    .select({ id: editor.id })
    .from(editor)
    .where(eq(editor.id, id));

  if (!existing) return NextResponse.json({ error: "Editor not found" }, { status: 404 });

  const updates: Partial<{
    name: string;
    slug: string;
    description: string | null;
    iconUrl: string | null;
    updatedAt: Date;
  }> = updatedTimestamp();

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
    if (isUniqueConstraintError(err)) {
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
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const [existing] = await db
    .select({ id: editor.id })
    .from(editor)
    .where(eq(editor.id, id));

  if (!existing) return NextResponse.json({ error: "Editor not found" }, { status: 404 });

  await db.delete(editor).where(eq(editor.id, id));

  return NextResponse.json({ success: true });
}

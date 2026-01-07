import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { resource, ResourceType } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

type UpdateResourceBody = {
  title?: unknown;
  url?: unknown;
  description?: unknown;
  type?: unknown;
};

function toCleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

const VALID_TYPES: ResourceType[] = ["video", "documentation", "article"];

function isValidType(value: unknown): value is ResourceType {
  return typeof value === "string" && VALID_TYPES.includes(value as ResourceType);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [resourceRow] = await db
    .select({
      id: resource.id,
      editorId: resource.editorId,
      title: resource.title,
      url: resource.url,
      description: resource.description,
      type: resource.type,
      createdAt: resource.createdAt,
    })
    .from(resource)
    .where(eq(resource.id, id));

  if (!resourceRow) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  return NextResponse.json({ resource: resourceRow });
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

  let body: UpdateResourceBody;
  try {
    body = (await req.json()) as UpdateResourceBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: resource.id })
    .from(resource)
    .where(eq(resource.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  const updates: Partial<{
    title: string;
    url: string;
    description: string | null;
    type: ResourceType;
    updatedAt: Date;
  }> = { updatedAt: new Date() };

  if (body.title !== undefined) {
    const title = toCleanString(body.title);
    if (!title) return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    updates.title = title;
  }

  if (body.url !== undefined) {
    const url = toCleanString(body.url);
    if (!url) return NextResponse.json({ error: "URL cannot be empty" }, { status: 400 });
    updates.url = url;
  }

  if (body.description !== undefined) {
    updates.description = toCleanString(body.description) || null;
  }

  if (body.type !== undefined) {
    if (!isValidType(body.type)) {
      return NextResponse.json({ error: "Type must be one of: video, documentation, article" }, { status: 400 });
    }
    updates.type = body.type;
  }

  await db.update(resource).set(updates).where(eq(resource.id, id));

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
    .select({ id: resource.id })
    .from(resource)
    .where(eq(resource.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  await db.delete(resource).where(eq(resource.id, id));

  return NextResponse.json({ success: true });
}


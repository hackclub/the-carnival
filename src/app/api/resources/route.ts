import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { editor, resource, ResourceType } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

type CreateResourceBody = {
  editorId?: unknown;
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

export async function GET(req: Request) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const editorId = searchParams.get("editorId");

  if (editorId) {
    const resources = await db
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
      .where(eq(resource.editorId, editorId))
      .orderBy(resource.type, resource.createdAt);

    return NextResponse.json({ resources });
  }

  // Return all resources grouped by editor
  const resources = await db
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
    .orderBy(resource.editorId, resource.type, resource.createdAt);

  return NextResponse.json({ resources });
}

export async function POST(req: Request) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Any authenticated user can create resources

  let body: CreateResourceBody;
  try {
    body = (await req.json()) as CreateResourceBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const editorId = toCleanString(body.editorId);
  const title = toCleanString(body.title);
  const url = toCleanString(body.url);
  const description = toCleanString(body.description) || null;
  const type = body.type;

  if (!editorId) return NextResponse.json({ error: "Editor ID is required" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });
  if (!isValidType(type)) {
    return NextResponse.json({ error: "Type must be one of: video, documentation, article" }, { status: 400 });
  }

  // Verify the editor exists
  const [editorRow] = await db
    .select({ id: editor.id })
    .from(editor)
    .where(eq(editor.id, editorId));

  if (!editorRow) {
    return NextResponse.json({ error: "Editor not found" }, { status: 404 });
  }

  const now = new Date();
  const id = randomUUID();

  await db.insert(resource).values({
    id,
    editorId,
    title,
    url,
    description,
    type,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id }, { status: 201 });
}


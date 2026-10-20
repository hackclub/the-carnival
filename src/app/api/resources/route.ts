import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { editor, resource, ResourceType } from "@/db/schema";
import {
  getAuthUser,
  parseJsonBody,
  toCleanString,
  generateId,
  timestamps,
} from "@/lib/api-utils";
import { sanitizeHttpUrl, sanitizeText, TEXT_LIMITS } from "@/lib/sanitize";

type CreateResourceBody = {
  editorId?: unknown;
  title?: unknown;
  url?: unknown;
  description?: unknown;
  type?: unknown;
};

const VALID_TYPES: ResourceType[] = ["video", "documentation", "article"];

function isValidType(value: unknown): value is ResourceType {
  return typeof value === "string" && VALID_TYPES.includes(value as ResourceType);
}

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await parseJsonBody<CreateResourceBody>(req);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const editorId = toCleanString(body.editorId);
  const title = sanitizeText(body.title, { maxLength: TEXT_LIMITS.name });
  const url = sanitizeHttpUrl(body.url);
  const description =
    sanitizeText(body.description, { maxLength: TEXT_LIMITS.longText, multiline: true }) || null;
  const type = body.type;

  if (!editorId) return NextResponse.json({ error: "Editor ID is required" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (url === null) {
    return NextResponse.json({ error: "URL must be a valid http(s) link" }, { status: 400 });
  }
  if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });
  if (!isValidType(type)) {
    return NextResponse.json({ error: "Type must be one of: video, documentation, article" }, { status: 400 });
  }

  const [editorRow] = await db
    .select({ id: editor.id })
    .from(editor)
    .where(eq(editor.id, editorId));

  if (!editorRow) return NextResponse.json({ error: "Editor not found" }, { status: 404 });

  const id = generateId();

  await db.insert(resource).values({
    id,
    editorId,
    title,
    url,
    description,
    type,
    ...timestamps(),
  });

  return NextResponse.json({ id }, { status: 201 });
}

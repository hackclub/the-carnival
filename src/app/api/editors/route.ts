import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { editor } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

type CreateEditorBody = {
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

export async function GET() {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const editors = await db
    .select({
      id: editor.id,
      name: editor.name,
      slug: editor.slug,
      description: editor.description,
      iconUrl: editor.iconUrl,
      createdAt: editor.createdAt,
    })
    .from(editor)
    .orderBy(editor.name);

  return NextResponse.json({ editors });
}

export async function POST(req: Request) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Any authenticated user can create editors

  let body: CreateEditorBody;
  try {
    body = (await req.json()) as CreateEditorBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = toCleanString(body.name);
  const slug = toSlug(body.slug || body.name);
  const description = toCleanString(body.description) || null;
  const iconUrl = toCleanString(body.iconUrl) || null;

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!slug) return NextResponse.json({ error: "Slug is required" }, { status: 400 });

  const now = new Date();
  const id = randomUUID();

  try {
    await db.insert(editor).values({
      id,
      name,
      slug,
      description,
      iconUrl,
      createdAt: now,
      updatedAt: now,
    });
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

  return NextResponse.json({ id }, { status: 201 });
}


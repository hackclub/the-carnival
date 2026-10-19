import { NextResponse } from "next/server";
import { db } from "@/db";
import { editor } from "@/db/schema";
import {
  getAuthUser,
  parseJsonBody,
  toSlug,
  generateId,
  timestamps,
  isUniqueConstraintError,
} from "@/lib/api-utils";
import { validatePlatformImageUrl } from "@/lib/review/uploads";
import { sanitizeHttpUrl, sanitizeText, TEXT_LIMITS } from "@/lib/sanitize";

type CreateEditorBody = {
  name?: unknown;
  slug?: unknown;
  description?: unknown;
  iconUrl?: unknown;
};

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await parseJsonBody<CreateEditorBody>(req);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const name = sanitizeText(body.name, { maxLength: TEXT_LIMITS.name });
  const slug = toSlug(sanitizeText(body.slug || body.name, { maxLength: TEXT_LIMITS.name }));
  const description =
    sanitizeText(body.description, { maxLength: TEXT_LIMITS.longText, multiline: true }) || null;
  const iconUrl = sanitizeHttpUrl(body.iconUrl);

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!slug) return NextResponse.json({ error: "Slug is required" }, { status: 400 });
  if (iconUrl === null) {
    return NextResponse.json({ error: "Icon URL must be a valid http(s) link" }, { status: 400 });
  }
  if (iconUrl) {
    // Icons render as <img> for every visitor, so only platform uploads.
    const iconValidation = validatePlatformImageUrl(iconUrl, "Editor icon");
    if (!iconValidation.ok) {
      return NextResponse.json({ error: iconValidation.error }, { status: 400 });
    }
  }

  const id = generateId();

  try {
    await db.insert(editor).values({
      id,
      name,
      slug,
      description,
      iconUrl: iconUrl || null,
      ...timestamps(),
    });
  } catch (err: unknown) {
    if (isUniqueConstraintError(err)) {
      return NextResponse.json({ error: "An editor with this name or slug already exists" }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ id }, { status: 201 });
}

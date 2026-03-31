import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { project, type ProjectEditor } from "@/db/schema";
import { normalizeCategory, normalizeProjectTags } from "@/lib/project-taxonomy";
import { getServerSession } from "@/lib/server-session";

type CreateProjectBody = {
  name?: unknown;
  description?: unknown;
  editor?: unknown;
  editorOther?: unknown;
  hackatimeProjectName?: unknown;
  hackatimeStartedAt?: unknown;
  hackatimeStoppedAt?: unknown;
  hackatimeTotalSeconds?: unknown;
  videoUrl?: unknown;
  playableDemoUrl?: unknown;
  codeUrl?: unknown;
  category?: unknown;
  tags?: unknown;
  screenshots?: unknown;
  status?: unknown;
};
const MIN_SCREENSHOTS = 3;

function toCleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidUrlString(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function toOptionalIsoDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toOptionalNonNegativeInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string") {
    const n = Number(value.trim());
    if (Number.isFinite(n) && Number.isInteger(n) && n >= 0) return n;
  }
  return null;
}

function isProjectEditor(value: unknown): value is ProjectEditor {
  return (
    value === "vscode" ||
    value === "chrome" ||
    value === "firefox" ||
    value === "figma" ||
    value === "neovim" ||
    value === "gnu-emacs" ||
    value === "jupyterlab" ||
    value === "obsidian" ||
    value === "blender" ||
    value === "freecad" ||
    value === "kicad" ||
    value === "krita" ||
    value === "gimp" ||
    value === "inkscape" ||
    value === "godot-engine" ||
    value === "unity" ||
    value === "other"
  );
}

export async function POST(req: Request) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateProjectBody;
  try {
    body = (await req.json()) as CreateProjectBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = toCleanString(body.name);
  const description = toCleanString(body.description);
  const editorRaw = typeof body.editor === "string" ? body.editor.trim() : body.editor;
  const editorOther = toCleanString(body.editorOther);
  const hackatimeProjectName = toCleanString(body.hackatimeProjectName);
  const hackatimeStartedAt = toOptionalIsoDate(body.hackatimeStartedAt);
  const hackatimeStoppedAt = toOptionalIsoDate(body.hackatimeStoppedAt);
  const hackatimeTotalSeconds = toOptionalNonNegativeInt(body.hackatimeTotalSeconds);
  const videoUrl = toCleanString(body.videoUrl);
  const playableDemoUrl = toCleanString(body.playableDemoUrl);
  const codeUrl = toCleanString(body.codeUrl);
  const category = normalizeCategory(body.category);
  const tags = normalizeProjectTags(body.tags);

  const screenshots = Array.isArray(body.screenshots)
    ? body.screenshots
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  if (!name) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: "Description is required" }, { status: 400 });
  }

  const editor =
    editorRaw === undefined || editorRaw === null || editorRaw === "" ? ("vscode" as const) : editorRaw;

  if (!isProjectEditor(editor)) {
    return NextResponse.json({ error: "Invalid editor" }, { status: 400 });
  }
  if (editor === "other" && !editorOther) {
    return NextResponse.json(
      { error: "Please enter the editor name (Other)" },
      { status: 400 },
    );
  }
  if (editor !== "other" && editorOther) {
    return NextResponse.json(
      { error: "Editor name should only be set when editor is Other" },
      { status: 400 },
    );
  }

  if (!videoUrl) {
    return NextResponse.json({ error: "Video link is required" }, { status: 400 });
  }
  if (!isValidUrlString(videoUrl)) {
    return NextResponse.json({ error: "Video link must be http(s)" }, { status: 400 });
  }
  if (!playableDemoUrl) {
    return NextResponse.json({ error: "Playable demo link is required" }, { status: 400 });
  }
  if (!isValidUrlString(playableDemoUrl)) {
    return NextResponse.json({ error: "Playable demo link must be http(s)" }, { status: 400 });
  }
  if (!codeUrl) {
    return NextResponse.json({ error: "Code URL is required" }, { status: 400 });
  }
  if (!isValidUrlString(codeUrl)) {
    return NextResponse.json({ error: "Code URL must be http(s)" }, { status: 400 });
  }
  if (screenshots.length < MIN_SCREENSHOTS) {
    return NextResponse.json(
      { error: `Please upload at least ${MIN_SCREENSHOTS} screenshots` },
      { status: 400 },
    );
  }

  const now = new Date();
  const id = randomUUID();

  await db.insert(project).values({
    id,
    creatorId: userId,
    name,
    description,
    editor,
    editorOther: editorOther || null,
    hackatimeProjectName,
    hackatimeStartedAt,
    hackatimeStoppedAt,
    hackatimeTotalSeconds,
    videoUrl,
    playableDemoUrl,
    codeUrl,
    category,
    tags,
    screenshots,
    // status: default in schema
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id }, { status: 201 });
}


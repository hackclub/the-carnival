import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { project, type ProjectEditor } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

type CreateProjectBody = {
  name?: unknown;
  description?: unknown;
  editor?: unknown;
  editorOther?: unknown;
  hackatimeProjectName?: unknown;
  playableUrl?: unknown;
  codeUrl?: unknown;
  screenshots?: unknown;
  status?: unknown;
};

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
  const playableUrl = toCleanString(body.playableUrl);
  const codeUrl = toCleanString(body.codeUrl);

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

  if (!isProjectEditor(editorRaw)) {
    return NextResponse.json({ error: "Editor is required" }, { status: 400 });
  }
  if (editorRaw === "other" && !editorOther) {
    return NextResponse.json(
      { error: "Please enter the editor name (Other)" },
      { status: 400 },
    );
  }
  if (editorRaw !== "other" && editorOther) {
    return NextResponse.json(
      { error: "Editor name should only be set when editor is Other" },
      { status: 400 },
    );
  }

  if (!hackatimeProjectName) {
    return NextResponse.json(
      { error: "Hackatime project name is required" },
      { status: 400 },
    );
  }
  if (!playableUrl) {
    return NextResponse.json({ error: "Playable URL is required" }, { status: 400 });
  }
  if (!isValidUrlString(playableUrl)) {
    return NextResponse.json({ error: "Playable URL must be http(s)" }, { status: 400 });
  }
  if (!codeUrl) {
    return NextResponse.json({ error: "Code URL is required" }, { status: 400 });
  }
  if (!isValidUrlString(codeUrl)) {
    return NextResponse.json({ error: "Code URL must be http(s)" }, { status: 400 });
  }

  const now = new Date();
  const id = randomUUID();

  await db.insert(project).values({
    id,
    creatorId: userId,
    name,
    description,
    editor: editorRaw,
    editorOther: editorOther || null,
    hackatimeProjectName,
    playableUrl,
    codeUrl,
    screenshots,
    // status: default in schema
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id }, { status: 201 });
}



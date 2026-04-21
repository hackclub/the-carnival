import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { project, type ProjectEditor } from "@/db/schema";
import { getFrozenAccountMessage, getFrozenAccountState } from "@/lib/frozen-account";
import { refreshHackatimeProjectSnapshotForRange } from "@/lib/hackatime";
import { parseConsideredHackatimeRange } from "@/lib/hackatime-range";
import { validateCreatorOriginalityDeclaration } from "@/lib/project-originality";
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
  creatorDeclaredOriginality?: unknown;
  creatorDuplicateExplanation?: unknown;
  creatorOriginalityRationale?: unknown;
  consideredHackatimeRange?: unknown;
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

function toOptionalTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

  const freezeState = await getFrozenAccountState(userId);
  if (freezeState.isFrozen) {
    return NextResponse.json(
      {
        error: getFrozenAccountMessage(freezeState.frozenReason),
        code: "account_frozen",
      },
      { status: 403 },
    );
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
  const videoUrl = toCleanString(body.videoUrl);
  const playableDemoUrl = toCleanString(body.playableDemoUrl);
  const codeUrl = toCleanString(body.codeUrl);
  const category = normalizeCategory(body.category);
  const tags = normalizeProjectTags(body.tags);
  const creatorDeclaredOriginality = body.creatorDeclaredOriginality;
  const parsedRange =
    body.consideredHackatimeRange === undefined
      ? null
      : parseConsideredHackatimeRange(body.consideredHackatimeRange);
  const consideredHackatimeRange = parsedRange && parsedRange.ok ? parsedRange.value : null;

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
  if (parsedRange && !parsedRange.ok) {
    return NextResponse.json({ error: parsedRange.error }, { status: 400 });
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
  if (typeof creatorDeclaredOriginality !== "boolean") {
    return NextResponse.json(
      { error: "Please declare whether your project overlaps with existing submissions." },
      { status: 400 },
    );
  }
  if (
    body.creatorDuplicateExplanation !== undefined &&
    body.creatorDuplicateExplanation !== null &&
    typeof body.creatorDuplicateExplanation !== "string"
  ) {
    return NextResponse.json(
      { error: "Duplicate overlap explanation must be text." },
      { status: 400 },
    );
  }
  if (
    body.creatorOriginalityRationale !== undefined &&
    body.creatorOriginalityRationale !== null &&
    typeof body.creatorOriginalityRationale !== "string"
  ) {
    return NextResponse.json(
      { error: "Originality rationale must be text." },
      { status: 400 },
    );
  }

  const originalityDeclaration = validateCreatorOriginalityDeclaration({
    creatorDeclaredOriginality,
    creatorDuplicateExplanation: toOptionalTrimmedString(body.creatorDuplicateExplanation),
    creatorOriginalityRationale: toOptionalTrimmedString(body.creatorOriginalityRationale),
  });
  if (!originalityDeclaration.ok) {
    return NextResponse.json({ error: originalityDeclaration.error }, { status: 400 });
  }

  if (hackatimeProjectName && !consideredHackatimeRange) {
    return NextResponse.json(
      { error: "Choose the considered Hackatime range before creating this project." },
      { status: 400 },
    );
  }
  if (!hackatimeProjectName && consideredHackatimeRange) {
    return NextResponse.json(
      { error: "Select a Hackatime project before choosing the considered range." },
      { status: 400 },
    );
  }

  let resolvedHackatimeStartedAt: Date | null = null;
  let resolvedHackatimeStoppedAt: Date | null = null;
  let resolvedHackatimeTotalSeconds: number | null = null;

  if (hackatimeProjectName && consideredHackatimeRange) {
    try {
      const refreshed = await refreshHackatimeProjectSnapshotForRange(userId, {
        projectName: hackatimeProjectName,
        range: consideredHackatimeRange,
      });
      resolvedHackatimeStartedAt = refreshed.hackatimeStartedAt;
      resolvedHackatimeStoppedAt = refreshed.hackatimeStoppedAt;
      resolvedHackatimeTotalSeconds = refreshed.hackatimeTotalSeconds;
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Failed to refresh Hackatime for the selected project range.";
      return NextResponse.json(
        { error: `Could not refresh the considered Hackatime range. ${message}` },
        { status: 400 },
      );
    }
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
    hackatimeStartedAt: resolvedHackatimeStartedAt,
    hackatimeStoppedAt: resolvedHackatimeStoppedAt,
    hackatimeTotalSeconds: resolvedHackatimeTotalSeconds,
    videoUrl,
    playableDemoUrl,
    codeUrl,
    category,
    tags,
    screenshots,
    creatorDeclaredOriginality: originalityDeclaration.value.creatorDeclaredOriginality,
    creatorDuplicateExplanation: originalityDeclaration.value.creatorDuplicateExplanation,
    creatorOriginalityRationale: originalityDeclaration.value.creatorOriginalityRationale,
    // Record the moment the project is officially started on Carnival.
    // Only hours logged between this timestamp and submittedAt are considered during review.
    startedOnCarnivalAt: now,
    // status: default in schema
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id }, { status: 201 });
}

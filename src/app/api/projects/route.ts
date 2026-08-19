import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { project, projectEditor, type ProjectEditor } from "@/db/schema";
import { getFrozenAccountMessage, getFrozenAccountState } from "@/lib/frozen-account";
import { refreshHackatimeProjectSnapshotForRange } from "@/lib/hackatime";
import { parseConsideredHackatimeRange } from "@/lib/hackatime-range";
import { validateCreatorOriginalityDeclaration } from "@/lib/project-originality";
import { normalizeCategory, normalizeProjectTags } from "@/lib/project-taxonomy";
import { getServerSession } from "@/lib/server-session";
import { validateLinkableBountyProjectId } from "@/lib/bounties";
import { DEFAULT_PROJECT_TYPE, isEnabledProjectType } from "@/lib/review/config";
import { isValidHttpUrlString } from "@/lib/review/urls";
import { validatePlatformImageUrls } from "@/lib/review/uploads";

type CreateProjectBody = {
  name?: unknown;
  description?: unknown;
  projectType?: unknown;
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
  bountyProjectId?: unknown;
  status?: unknown;
};

function toCleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toOptionalTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isProjectEditor(value: unknown): value is ProjectEditor {
  return (
    typeof value === "string" &&
    (projectEditor.enumValues as readonly string[]).includes(value)
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

  // Project type defaults to the program's configured type (Carnival:
  // extension/plugin) and must be one this program has enabled.
  const projectTypeValue =
    body.projectType === undefined || body.projectType === null || body.projectType === ""
      ? DEFAULT_PROJECT_TYPE
      : body.projectType;
  if (!isEnabledProjectType(projectTypeValue)) {
    return NextResponse.json({ error: "Invalid project type for this program." }, { status: 400 });
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

  // URL fields are optional at creation; validated only if provided. The full
  // per-type rules (allowlists, blocklists) are enforced by the submission
  // gates when the project is submitted for review.
  if (videoUrl && !isValidHttpUrlString(videoUrl)) {
    return NextResponse.json({ error: "Video link must be http(s)" }, { status: 400 });
  }
  if (playableDemoUrl && !isValidHttpUrlString(playableDemoUrl)) {
    return NextResponse.json({ error: "Playable demo link must be http(s)" }, { status: 400 });
  }
  if (codeUrl && !isValidHttpUrlString(codeUrl)) {
    return NextResponse.json({ error: "Code URL must be http(s)" }, { status: 400 });
  }

  // Screenshots must come from the platform's own upload flow (PNG/JPG on our
  // R2 bucket) — pasted external image URLs are rejected at write time.
  if (screenshots.length > 0) {
    const screenshotValidation = validatePlatformImageUrls(screenshots, "Screenshot");
    if (!screenshotValidation.ok) {
      return NextResponse.json({ error: screenshotValidation.error }, { status: 400 });
    }
  }

  // Originality declaration is optional at creation; defaults if not provided
  const creatorDeclaredOriginality =
    typeof body.creatorDeclaredOriginality === "boolean"
      ? body.creatorDeclaredOriginality
      : false;

  let originalityValues = {
    creatorDeclaredOriginality: false,
    creatorDuplicateExplanation: null as string | null,
    creatorOriginalityRationale: null as string | null,
  };

  if (typeof body.creatorDeclaredOriginality === "boolean") {
    const originalityDeclaration = validateCreatorOriginalityDeclaration({
      creatorDeclaredOriginality,
      creatorDuplicateExplanation: toOptionalTrimmedString(body.creatorDuplicateExplanation),
      creatorOriginalityRationale: toOptionalTrimmedString(body.creatorOriginalityRationale),
    });
    if (!originalityDeclaration.ok) {
      return NextResponse.json({ error: originalityDeclaration.error }, { status: 400 });
    }
    originalityValues = originalityDeclaration.value;
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

  const bountyProjectId =
    typeof body.bountyProjectId === "string" && body.bountyProjectId.trim()
      ? body.bountyProjectId.trim()
      : null;
  const bountyValidation = await validateLinkableBountyProjectId(bountyProjectId);
  if (!bountyValidation.ok) {
    return NextResponse.json({ error: bountyValidation.error }, { status: 400 });
  }

  const now = new Date();
  const id = randomUUID();

  await db.insert(project).values({
    id,
    creatorId: userId,
    name,
    description,
    projectType: projectTypeValue,
    editor,
    editorOther: editorOther || null,
    hackatimeProjectName: hackatimeProjectName || "",
    hackatimeStartedAt: resolvedHackatimeStartedAt,
    hackatimeStoppedAt: resolvedHackatimeStoppedAt,
    hackatimeTotalSeconds: resolvedHackatimeTotalSeconds,
    videoUrl: videoUrl || "",
    playableDemoUrl: playableDemoUrl || "",
    codeUrl: codeUrl || "",
    category,
    tags,
    screenshots,
    creatorDeclaredOriginality: originalityValues.creatorDeclaredOriginality,
    creatorDuplicateExplanation: originalityValues.creatorDuplicateExplanation,
    creatorOriginalityRationale: originalityValues.creatorOriginalityRationale,
    bountyProjectId,
    startedOnCarnivalAt: now,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id }, { status: 201 });
}

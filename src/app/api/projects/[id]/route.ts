import { NextResponse } from "next/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  project,
  user,
  type ProjectEditor,
  type ProjectStatus,
  type ProjectSubmissionChecklist,
} from "@/db/schema";
import { refreshHackatimeProjectSnapshotForRange } from "@/lib/hackatime";
import {
  getProjectConsideredHackatimeRange,
  parseConsideredHackatimeRange,
  type ConsideredHackatimeRange,
} from "@/lib/hackatime-range";
import {
  hasRequiredProjectSubmissionChecklistAnswers,
  parseProjectSubmissionChecklist,
} from "@/lib/project-submission-checklist";
import { validateCreatorOriginalityDeclaration } from "@/lib/project-originality";
import { normalizeCategory, normalizeProjectTags } from "@/lib/project-taxonomy";
import { getFrozenAccountMessage, getFrozenAccountState } from "@/lib/frozen-account";
import { approvedHoursWithinSnapshot } from "@/lib/review-rules";
import { getServerSession } from "@/lib/server-session";
import { notifyReviewDM } from "@/lib/slack";

type UpdateProjectBody = {
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
  submissionChecklist?: unknown;
  creatorDeclaredOriginality?: unknown;
  creatorDuplicateExplanation?: unknown;
  creatorOriginalityRationale?: unknown;
  consideredHackatimeRange?: unknown;
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

function isUserEditableStatus(
  value: unknown,
): value is Extract<ProjectStatus, "work-in-progress" | "in-review"> {
  // Creators can set work-in-progress or submit for review (in-review).
  // Shipped is set by reviewers/admins after approval.
  return value === "work-in-progress" || value === "in-review";
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const rows = await db
    .select({
      id: project.id,
      creatorId: project.creatorId,
      name: project.name,
      description: project.description,
      category: project.category,
      tags: project.tags,
      editor: project.editor,
      editorOther: project.editorOther,
      hackatimeProjectName: project.hackatimeProjectName,
      hackatimeStartedAt: project.hackatimeStartedAt,
      hackatimeStoppedAt: project.hackatimeStoppedAt,
      hackatimeTotalSeconds: project.hackatimeTotalSeconds,
      videoUrl: project.videoUrl,
      playableDemoUrl: project.playableDemoUrl,
      codeUrl: project.codeUrl,
      screenshots: project.screenshots,
      submissionChecklist: project.submissionChecklist,
      creatorDeclaredOriginality: project.creatorDeclaredOriginality,
      creatorDuplicateExplanation: project.creatorDuplicateExplanation,
      creatorOriginalityRationale: project.creatorOriginalityRationale,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    })
    .from(project)
    .where(and(eq(project.id, id), eq(project.creatorId, userId)))
    .limit(1);

  const p = rows[0];
  if (!p) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ project: p });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: unknown } | undefined)?.role;
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

  const { id } = await ctx.params;

  const existing = await db
    .select({
      status: project.status,
      approvedHours: project.approvedHours,
      name: project.name,
      description: project.description,
      category: project.category,
      tags: project.tags,
      editor: project.editor,
      editorOther: project.editorOther,
      hackatimeProjectName: project.hackatimeProjectName,
      hackatimeStartedAt: project.hackatimeStartedAt,
      hackatimeStoppedAt: project.hackatimeStoppedAt,
      hackatimeTotalSeconds: project.hackatimeTotalSeconds,
      videoUrl: project.videoUrl,
      playableDemoUrl: project.playableDemoUrl,
      codeUrl: project.codeUrl,
      screenshots: project.screenshots,
      submissionChecklist: project.submissionChecklist,
      creatorDeclaredOriginality: project.creatorDeclaredOriginality,
      creatorDuplicateExplanation: project.creatorDuplicateExplanation,
      creatorOriginalityRationale: project.creatorOriginalityRationale,
      submittedAt: project.submittedAt,
      createdAt: project.createdAt,
    })
    .from(project)
    .where(and(eq(project.id, id), eq(project.creatorId, userId)))
    .limit(1);

  const current = existing[0];
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Granted projects are immutable for creators; only admins can change them.
  if (current.status === "granted" && role !== "admin") {
    return NextResponse.json(
      { error: "This project has been granted and can no longer be edited." },
      { status: 403 },
    );
  }

  let body: UpdateProjectBody;
  try {
    body = (await req.json()) as UpdateProjectBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const set: Partial<{
    name: string;
    description: string;
    category: string | null;
    tags: string[];
    editor: ProjectEditor;
    editorOther: string | null;
    hackatimeProjectName: string;
    hackatimeStartedAt: Date | null;
    hackatimeStoppedAt: Date | null;
    hackatimeTotalSeconds: number | null;
    videoUrl: string;
    playableDemoUrl: string;
    codeUrl: string;
    screenshots: string[];
    submissionChecklist: ProjectSubmissionChecklist | null;
    creatorDeclaredOriginality: boolean;
    creatorDuplicateExplanation: string | null;
    creatorOriginalityRationale: string | null;
    status: ProjectStatus;
    approvedHours: number | null;
    submittedAt: Date;
    updatedAt: Date;
  }> = {};

  let consideredHackatimeRange: ConsideredHackatimeRange | null | undefined;

  if (body.consideredHackatimeRange !== undefined) {
    const parsedRange = parseConsideredHackatimeRange(body.consideredHackatimeRange);
    if (!parsedRange.ok) {
      return NextResponse.json({ error: parsedRange.error }, { status: 400 });
    }
    consideredHackatimeRange = parsedRange.value;
  }

  let refreshedHackatimeSnapshot: {
    hackatimeStartedAt: Date;
    hackatimeStoppedAt: Date;
    hackatimeTotalSeconds: number;
  } | null = null;
  let refreshedHackatimeTotalSeconds: number | null = null;

  async function refreshHackatimeSnapshot(range: ConsideredHackatimeRange, projectName: string) {
    const refreshed = await refreshHackatimeProjectSnapshotForRange(userId!, {
      projectName,
      range,
    });
    refreshedHackatimeSnapshot = {
      hackatimeStartedAt: refreshed.hackatimeStartedAt,
      hackatimeStoppedAt: refreshed.hackatimeStoppedAt,
      hackatimeTotalSeconds: refreshed.hackatimeTotalSeconds,
    };
    refreshedHackatimeTotalSeconds = refreshed.hackatimeTotalSeconds;
    set.hackatimeStartedAt = refreshed.hackatimeStartedAt;
    set.hackatimeStoppedAt = refreshed.hackatimeStoppedAt;
    set.hackatimeTotalSeconds = refreshed.hackatimeTotalSeconds;
    return refreshed;
  }

  const editorRaw =
    body.editor !== undefined
      ? typeof body.editor === "string"
        ? body.editor.trim()
        : body.editor
      : undefined;
  const editorOtherRaw = body.editorOther !== undefined ? toCleanString(body.editorOther) : undefined;

  if (body.name !== undefined) {
    const name = toCleanString(body.name);
    if (!name) return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    set.name = name;
  }

  if (body.description !== undefined) {
    const description = toCleanString(body.description);
    if (!description) return NextResponse.json({ error: "Description is required" }, { status: 400 });
    set.description = description;
  }

  if (body.category !== undefined) {
    set.category = normalizeCategory(body.category);
  }

  if (body.tags !== undefined) {
    set.tags = normalizeProjectTags(body.tags);
  }

  if (editorRaw !== undefined) {
    if (!isProjectEditor(editorRaw)) {
      return NextResponse.json({ error: "Invalid editor" }, { status: 400 });
    }
    set.editor = editorRaw;
    if (editorRaw !== "other") {
      // Clear any lingering other editor name if switching away.
      set.editorOther = null;
    }
  }

  if (editorOtherRaw !== undefined) {
    set.editorOther = editorOtherRaw || null;
  }

  if (body.hackatimeProjectName !== undefined) {
    const hackatimeProjectName = toCleanString(body.hackatimeProjectName);
    set.hackatimeProjectName = hackatimeProjectName;
  }
  if (body.hackatimeStartedAt !== undefined) {
    set.hackatimeStartedAt = toOptionalIsoDate(body.hackatimeStartedAt);
  }
  if (body.hackatimeStoppedAt !== undefined) {
    set.hackatimeStoppedAt = toOptionalIsoDate(body.hackatimeStoppedAt);
  }
  if (body.hackatimeTotalSeconds !== undefined) {
    set.hackatimeTotalSeconds = toOptionalNonNegativeInt(body.hackatimeTotalSeconds);
  }

  const nextHackatimeProjectName = (set.hackatimeProjectName ?? current.hackatimeProjectName).trim();
  if (consideredHackatimeRange) {
    if (!nextHackatimeProjectName) {
      return NextResponse.json(
        { error: "Select a Hackatime project before choosing the considered range." },
        { status: 400 },
      );
    }
    try {
      await refreshHackatimeSnapshot(consideredHackatimeRange, nextHackatimeProjectName);
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
  } else if (body.hackatimeProjectName !== undefined && !nextHackatimeProjectName) {
    set.hackatimeStartedAt = null;
    set.hackatimeStoppedAt = null;
    set.hackatimeTotalSeconds = null;
  }

  if (body.videoUrl !== undefined) {
    const videoUrl = toCleanString(body.videoUrl);
    if (videoUrl && !isValidUrlString(videoUrl)) {
      return NextResponse.json({ error: "Video link must be http(s)" }, { status: 400 });
    }
    set.videoUrl = videoUrl;
  }

  if (body.playableDemoUrl !== undefined) {
    const playableDemoUrl = toCleanString(body.playableDemoUrl);
    if (playableDemoUrl && !isValidUrlString(playableDemoUrl)) {
      return NextResponse.json({ error: "Playable demo link must be http(s)" }, { status: 400 });
    }
    set.playableDemoUrl = playableDemoUrl;
  }

  if (body.codeUrl !== undefined) {
    const codeUrl = toCleanString(body.codeUrl);
    if (!codeUrl) return NextResponse.json({ error: "Code URL is required" }, { status: 400 });
    if (!isValidUrlString(codeUrl)) {
      return NextResponse.json({ error: "Code URL must be http(s)" }, { status: 400 });
    }
    set.codeUrl = codeUrl;
  }

  if (body.screenshots !== undefined) {
    const screenshots = Array.isArray(body.screenshots)
      ? body.screenshots
          .filter((s): s is string => typeof s === "string")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    set.screenshots = screenshots;
  }

  if (body.submissionChecklist !== undefined) {
    const submissionChecklist = parseProjectSubmissionChecklist(body.submissionChecklist);
    if (!submissionChecklist) {
      return NextResponse.json({ error: "Invalid submission checklist." }, { status: 400 });
    }
    set.submissionChecklist = submissionChecklist;
  }

  if (body.status !== undefined) {
    if (!isUserEditableStatus(body.status)) {
      return NextResponse.json(
        { error: "Invalid status. Allowed: work-in-progress, in-review" },
        { status: 400 },
      );
    }
    set.status = body.status;
  }

  const originalityDeclarationRequested =
    body.creatorDeclaredOriginality !== undefined ||
    body.creatorDuplicateExplanation !== undefined ||
    body.creatorOriginalityRationale !== undefined;

  if (originalityDeclarationRequested) {
    if (
      body.creatorDeclaredOriginality !== undefined &&
      typeof body.creatorDeclaredOriginality !== "boolean"
    ) {
      return NextResponse.json(
        { error: "Creator originality declaration must be true or false." },
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

    const nextCreatorDeclaredOriginality =
      body.creatorDeclaredOriginality !== undefined
        ? body.creatorDeclaredOriginality
        : current.creatorDeclaredOriginality;
    let nextCreatorDuplicateExplanation =
      body.creatorDuplicateExplanation !== undefined
        ? toOptionalTrimmedString(body.creatorDuplicateExplanation)
        : current.creatorDuplicateExplanation;
    let nextCreatorOriginalityRationale =
      body.creatorOriginalityRationale !== undefined
        ? toOptionalTrimmedString(body.creatorOriginalityRationale)
        : current.creatorOriginalityRationale;

    // Explicitly switching to "fully original" clears overlap fields unless explicitly re-sent.
    if (body.creatorDeclaredOriginality === true) {
      if (body.creatorDuplicateExplanation === undefined) {
        nextCreatorDuplicateExplanation = null;
      }
      if (body.creatorOriginalityRationale === undefined) {
        nextCreatorOriginalityRationale = null;
      }
    }

    const originalityDeclaration = validateCreatorOriginalityDeclaration({
      creatorDeclaredOriginality: nextCreatorDeclaredOriginality,
      creatorDuplicateExplanation: nextCreatorDuplicateExplanation,
      creatorOriginalityRationale: nextCreatorOriginalityRationale,
    });

    if (!originalityDeclaration.ok) {
      return NextResponse.json({ error: originalityDeclaration.error }, { status: 400 });
    }

    set.creatorDeclaredOriginality = originalityDeclaration.value.creatorDeclaredOriginality;
    set.creatorDuplicateExplanation = originalityDeclaration.value.creatorDuplicateExplanation;
    set.creatorOriginalityRationale = originalityDeclaration.value.creatorOriginalityRationale;
  }

  // Validate final editor/editorOther combination (using current values + pending updates).
  const nextEditor = (set.editor ?? current.editor) as ProjectEditor;
  const nextEditorOther =
    set.editorOther !== undefined ? set.editorOther : (current.editorOther ?? null);
  if (nextEditor === "other" && !nextEditorOther) {
    return NextResponse.json(
      { error: "Please enter the editor name (Other)" },
      { status: 400 },
    );
  }
  if (nextEditor !== "other" && nextEditorOther) {
    return NextResponse.json(
      { error: "Editor name should only be set when editor is Other" },
      { status: 400 },
    );
  }

  // Enforce required fields when the project is in the review queue.
  const nextStatus = (set.status ?? current.status) as ProjectStatus;
  if (nextStatus === "in-review") {
    const nextName = (set.name ?? current.name).trim();
    const nextDescription = (set.description ?? current.description).trim();
    const nextHackatime = nextHackatimeProjectName;
    const nextVideo = (set.videoUrl ?? current.videoUrl).trim();
    const nextPlayableDemo = (set.playableDemoUrl ?? current.playableDemoUrl).trim();
    const nextCodeUrl = (set.codeUrl ?? current.codeUrl).trim();
    const nextScreenshots = (set.screenshots ?? current.screenshots) ?? [];
    const nextSubmissionChecklist =
      set.submissionChecklist !== undefined
        ? set.submissionChecklist
        : (current.submissionChecklist ?? null);

    if (!nextName) return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    if (!nextDescription) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }
    if (!nextHackatime) {
      return NextResponse.json(
        { error: "Hackatime project name is required to submit for review" },
        { status: 400 },
      );
    }
    if (!nextVideo) {
      return NextResponse.json(
        { error: "Video link is required to submit for review" },
        { status: 400 },
      );
    }
    if (!isValidUrlString(nextVideo)) {
      return NextResponse.json({ error: "Video link must be http(s)" }, { status: 400 });
    }
    if (!nextPlayableDemo) {
      return NextResponse.json(
        { error: "Playable demo link is required to submit for review" },
        { status: 400 },
      );
    }
    if (!isValidUrlString(nextPlayableDemo)) {
      return NextResponse.json({ error: "Playable demo link must be http(s)" }, { status: 400 });
    }
    if (!nextCodeUrl) {
      return NextResponse.json({ error: "GitHub URL is required" }, { status: 400 });
    }
    if (!isValidUrlString(nextCodeUrl)) {
      return NextResponse.json({ error: "GitHub URL must be http(s)" }, { status: 400 });
    }
    if (!Array.isArray(nextScreenshots) || nextScreenshots.length === 0) {
      return NextResponse.json(
        { error: "At least one screenshot is required to submit for review" },
        { status: 400 },
      );
    }

    const hasSubmittedBefore = !!current.submittedAt;
    const shouldValidateChecklist = !hasSubmittedBefore || !!nextSubmissionChecklist;
    if (
      shouldValidateChecklist &&
      !hasRequiredProjectSubmissionChecklistAnswers(nextSubmissionChecklist)
    ) {
      return NextResponse.json(
        { error: "Please complete all required checklist items before submitting for review." },
        { status: 400 },
      );
    }

    // Shipping/profile fields are required on the first-ever submission.
    // (After that, users can still edit them in /account, but we don't block re-submissions.)
    if (current.status !== "in-review") {
      const prior = await db
        .select({ id: project.id })
        .from(project)
        .where(and(eq(project.creatorId, userId), isNotNull(project.submittedAt)))
        .limit(1);

      const hasSubmittedBefore = !!prior[0];
      if (!hasSubmittedBefore) {
        const profileRows = await db
          .select({
            addressLine1: user.addressLine1,
            city: user.city,
            stateProvince: user.stateProvince,
            country: user.country,
            zipPostalCode: user.zipPostalCode,
          })
          .from(user)
          .where(eq(user.id, userId))
          .limit(1);

        const profile = profileRows[0];
        const missing: string[] = [];
        if (!profile?.addressLine1?.trim()) missing.push("Address (Line 1)");
        if (!profile?.city?.trim()) missing.push("City");
        if (!profile?.stateProvince?.trim()) missing.push("State / Province");
        if (!profile?.country?.trim()) missing.push("Country");
        if (!profile?.zipPostalCode?.trim()) missing.push("ZIP / Postal Code");

        if (missing.length) {
          return NextResponse.json(
            {
              error:
                "Before submitting your first project, please add your shipping address in Account settings (/account).",
              code: "missing_profile_address",
              missing,
            },
            { status: 400 },
          );
        }
      }

      const rangeForSubmission =
        consideredHackatimeRange ??
        getProjectConsideredHackatimeRange({
          hackatimeStartedAt: set.hackatimeStartedAt ?? current.hackatimeStartedAt,
          hackatimeStoppedAt: set.hackatimeStoppedAt ?? current.hackatimeStoppedAt,
          submittedAt: current.submittedAt,
          createdAt: current.createdAt,
        });

      if (!rangeForSubmission) {
        return NextResponse.json(
          { error: "Choose the considered Hackatime range before submitting for review." },
          { status: 400 },
        );
      }

      try {
        if (!refreshedHackatimeSnapshot) {
          await refreshHackatimeSnapshot(rangeForSubmission, nextHackatime);
        }
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

    // If we are (re-)entering the review queue, refresh the queue timestamp.
    if (current.status !== "in-review") {
      set.submittedAt = new Date();
    }
  }

  const nextResolvedStatus = (set.status ?? current.status) as ProjectStatus;
  let notice: string | null = null;
  if (
    refreshedHackatimeSnapshot &&
    current.status === "shipped" &&
    nextResolvedStatus === "shipped" &&
    current.approvedHours !== null &&
    refreshedHackatimeTotalSeconds !== null &&
    !approvedHoursWithinSnapshot(current.approvedHours, refreshedHackatimeTotalSeconds)
  ) {
    set.status = "in-review";
    set.approvedHours = null;
    set.submittedAt = new Date();
    notice =
      "Saved changes and returned the project to review because the refreshed Hackatime range is now below the previously approved hours.";
  }

  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  set.updatedAt = new Date();

  const updated = await db
    .update(project)
    .set(set)
    .where(and(eq(project.id, id), eq(project.creatorId, userId)))
    .returning({
      id: project.id,
      creatorId: project.creatorId,
      name: project.name,
      description: project.description,
      category: project.category,
      tags: project.tags,
      editor: project.editor,
      editorOther: project.editorOther,
      hackatimeProjectName: project.hackatimeProjectName,
      hackatimeStartedAt: project.hackatimeStartedAt,
      hackatimeStoppedAt: project.hackatimeStoppedAt,
      hackatimeTotalSeconds: project.hackatimeTotalSeconds,
      videoUrl: project.videoUrl,
      playableDemoUrl: project.playableDemoUrl,
      codeUrl: project.codeUrl,
      screenshots: project.screenshots,
      submissionChecklist: project.submissionChecklist,
      creatorDeclaredOriginality: project.creatorDeclaredOriginality,
      creatorDuplicateExplanation: project.creatorDuplicateExplanation,
      creatorOriginalityRationale: project.creatorOriginalityRationale,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });

  const p = updated[0];
  if (!p) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If creator just submitted for review, send them a Slack DM (best-effort).
  if (current.status !== "in-review" && p.status === "in-review") {
    try {
      const creator = await db
        .select({ slackId: user.slackId })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      const slackId = creator[0]?.slackId;
      if (slackId) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
        let projectLink = `/projects/${p.id}`;
        if (appUrl) {
          try {
            projectLink = new URL(`/projects/${p.id}`, appUrl).toString();
          } catch {
            // fall back to relative
          }
        }

        await notifyReviewDM({
          slackId,
          projectName: p.name,
          status: "submitted",
          projectUrl: projectLink,
          creatorSlackId: slackId,
        });
      }
    } catch (err) {
      console.warn("notifyReviewDM on submit failed", err);
    }
  }

  return NextResponse.json({ project: p, notice });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const { id } = await ctx.params;

  const existing = await db
    .select({ status: project.status, creatorId: project.creatorId })
    .from(project)
    .where(eq(project.id, id))
    .limit(1);

  const current = existing[0];
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (current.creatorId !== userId) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 },
    );
  }
  const isDeletable = current.status === "work-in-progress";
  if (!isDeletable) {
    return NextResponse.json(
      { error: "Projects can only be deleted while work-in-progress." },
      { status: 403 },
    );
  }

  await db.delete(project).where(and(eq(project.id, id), eq(project.creatorId, userId)));

  return NextResponse.json({ ok: true });
}

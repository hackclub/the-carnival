import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { project, user, type ProjectEditor, type ProjectStatus } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";
import { notifyReviewDM } from "@/lib/slack";

type UpdateProjectBody = {
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
      editor: project.editor,
      editorOther: project.editorOther,
      hackatimeProjectName: project.hackatimeProjectName,
      playableUrl: project.playableUrl,
      codeUrl: project.codeUrl,
      screenshots: project.screenshots,
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

  const { id } = await ctx.params;

  const existing = await db
    .select({
      status: project.status,
      approvedHours: project.approvedHours,
      name: project.name,
      description: project.description,
      editor: project.editor,
      editorOther: project.editorOther,
      hackatimeProjectName: project.hackatimeProjectName,
      playableUrl: project.playableUrl,
      codeUrl: project.codeUrl,
      screenshots: project.screenshots,
      submittedAt: project.submittedAt,
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
    editor: ProjectEditor;
    editorOther: string | null;
    hackatimeProjectName: string;
    playableUrl: string;
    codeUrl: string;
    screenshots: string[];
    status: ProjectStatus;
    approvedHours: number | null;
    submittedAt: Date;
    updatedAt: Date;
  }> = {};

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

  if (body.playableUrl !== undefined) {
    const playableUrl = toCleanString(body.playableUrl);
    if (playableUrl && !isValidUrlString(playableUrl)) {
      return NextResponse.json({ error: "Demo video URL must be http(s)" }, { status: 400 });
    }
    set.playableUrl = playableUrl;
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

  if (body.status !== undefined) {
    if (!isUserEditableStatus(body.status)) {
      return NextResponse.json(
        { error: "Invalid status. Allowed: work-in-progress, in-review" },
        { status: 400 },
      );
    }
    set.status = body.status;
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
    const nextHackatime = (set.hackatimeProjectName ?? current.hackatimeProjectName).trim();
    const nextPlayable = (set.playableUrl ?? current.playableUrl).trim();
    const nextCodeUrl = (set.codeUrl ?? current.codeUrl).trim();
    const nextScreenshots = (set.screenshots ?? current.screenshots) ?? [];

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
    if (!nextPlayable) {
      return NextResponse.json(
        { error: "Demo video URL is required to submit for review" },
        { status: 400 },
      );
    }
    if (!isValidUrlString(nextPlayable)) {
      return NextResponse.json({ error: "Demo video URL must be http(s)" }, { status: 400 });
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

    // If we are (re-)entering the review queue, refresh the queue timestamp.
    if (current.status !== "in-review") {
      set.submittedAt = new Date();
    }
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
      editor: project.editor,
      editorOther: project.editorOther,
      hackatimeProjectName: project.hackatimeProjectName,
      playableUrl: project.playableUrl,
      codeUrl: project.codeUrl,
      screenshots: project.screenshots,
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

  return NextResponse.json({ project: p });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const existing = await db
    .select({ status: project.status })
    .from(project)
    .where(and(eq(project.id, id), eq(project.creatorId, userId)))
    .limit(1);

  const current = existing[0];
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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



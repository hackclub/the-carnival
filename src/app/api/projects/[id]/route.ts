import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { project, type ProjectStatus } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

type UpdateProjectBody = {
  name?: unknown;
  description?: unknown;
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
    .select({ status: project.status })
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
    hackatimeProjectName: string;
    playableUrl: string;
    codeUrl: string;
    screenshots: string[];
    status: ProjectStatus;
    updatedAt: Date;
  }> = {};

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

  if (body.hackatimeProjectName !== undefined) {
    const hackatimeProjectName = toCleanString(body.hackatimeProjectName);
    if (!hackatimeProjectName) {
      return NextResponse.json(
        { error: "Hackatime project name is required" },
        { status: 400 },
      );
    }
    set.hackatimeProjectName = hackatimeProjectName;
  }

  if (body.playableUrl !== undefined) {
    const playableUrl = toCleanString(body.playableUrl);
    if (!playableUrl) {
      return NextResponse.json({ error: "Playable URL is required" }, { status: 400 });
    }
    if (!isValidUrlString(playableUrl)) {
      return NextResponse.json({ error: "Playable URL must be http(s)" }, { status: 400 });
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

  return NextResponse.json({ project: p });
}



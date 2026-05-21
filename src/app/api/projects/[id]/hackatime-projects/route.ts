import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { devlog, projectHackatimeProject } from "@/db/schema";
import {
  listProjectHackatimeProjects,
  upsertProjectHackatimeProject,
} from "@/lib/devlogs";
import { canReadProject, resolveProjectAccess } from "@/lib/project-route";

/**
 * GET /api/projects/[id]/hackatime-projects
 * List all Hackatime project names linked to this carnival project.
 * Accessible by the creator, reviewers, and admins.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;

  const access = await resolveProjectAccess(projectId);
  if ("error" in access) return access.error;
  if (!canReadProject(access.role, access.project.creatorId === access.userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const linked = await listProjectHackatimeProjects(projectId);
  return NextResponse.json({ projects: linked });
}

/**
 * POST /api/projects/[id]/hackatime-projects
 * Body: { name: string }
 * Explicitly link a Hackatime project name to this carnival project without
 * requiring a devlog. Creator-only.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;

  const access = await resolveProjectAccess(projectId);
  if ("error" in access) return access.error;
  if (access.project.creatorId !== access.userId) {
    return NextResponse.json(
      { error: "Only the project creator can manage linked projects." },
      { status: 403 },
    );
  }

  let body: { name?: unknown };
  try {
    body = (await req.json()) as { name?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Hackatime project name is required." }, { status: 400 });
  }
  if (name.length > 200) {
    return NextResponse.json({ error: "Project name is too long." }, { status: 400 });
  }

  const existing = await listProjectHackatimeProjects(projectId);
  // Only make this the default if there are no linked projects yet AND the
  // project has no canonical hackatimeProjectName set. This prevents
  // overwriting an existing primary project name when a user adds an extra one.
  const hasCanonicalName = (access.project.hackatimeProjectName ?? "").trim().length > 0;
  const makeDefault = existing.length === 0 && !hasCanonicalName;

  await upsertProjectHackatimeProject({ projectId, name, makeDefault });

  const linked = await listProjectHackatimeProjects(projectId);
  return NextResponse.json({ projects: linked }, { status: 201 });
}

/**
 * DELETE /api/projects/[id]/hackatime-projects?name=...
 * Remove a linked Hackatime project name. Only entries with no associated
 * devlogs (firstDevlogId is null, or the devlog has since been deleted) can
 * be removed. Creator-only.
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;

  const access = await resolveProjectAccess(projectId);
  if ("error" in access) return access.error;
  if (access.project.creatorId !== access.userId) {
    return NextResponse.json(
      { error: "Only the project creator can manage linked projects." },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const name = url.searchParams.get("name")?.trim() ?? "";
  if (!name) {
    return NextResponse.json({ error: "name query parameter is required." }, { status: 400 });
  }

  const allLinked = await db
    .select({
      id: projectHackatimeProject.id,
      name: projectHackatimeProject.name,
      firstDevlogId: projectHackatimeProject.firstDevlogId,
      isDefault: projectHackatimeProject.isDefault,
    })
    .from(projectHackatimeProject)
    .where(eq(projectHackatimeProject.projectId, projectId));

  const found = allLinked.find((r) => r.name.toLowerCase() === name.toLowerCase());
  if (!found) {
    return NextResponse.json({ error: "Linked project not found." }, { status: 404 });
  }

  // Block removal if a devlog still exists for this project name
  if (found.firstDevlogId) {
    const devlogRows = await db
      .select({ id: devlog.id })
      .from(devlog)
      .where(and(eq(devlog.id, found.firstDevlogId), eq(devlog.projectId, projectId)))
      .limit(1);
    if (devlogRows.length > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot remove a Hackatime project that has devlogs recorded against it. Delete those devlogs first.",
        },
        { status: 409 },
      );
    }
  }

  await db
    .delete(projectHackatimeProject)
    .where(eq(projectHackatimeProject.id, found.id));

  // If the deleted entry was the default, promote the alphabetically-first remaining entry
  if (found.isDefault) {
    const remaining = allLinked.filter((r) => r.id !== found.id);
    if (remaining.length > 0) {
      const next = remaining.sort((a, b) => a.name.localeCompare(b.name))[0];
      await db
        .update(projectHackatimeProject)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(projectHackatimeProject.id, next.id));
    }
  }

  const linked = await listProjectHackatimeProjects(projectId);
  return NextResponse.json({ projects: linked });
}

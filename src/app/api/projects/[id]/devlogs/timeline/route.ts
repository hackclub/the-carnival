import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { project, user } from "@/db/schema";
import { listProjectHackatimeProjects } from "@/lib/devlogs";
import { fetchHackatimeAdminTimeline } from "@/lib/hackatime";
import { getServerSession } from "@/lib/server-session";

/**
 * GET /api/projects/[id]/devlogs/timeline?date=YYYY-MM-DD
 *
 * Returns the user's Hackatime coding spans for the given day, with each span
 * annotated to indicate whether it involves any of the project's linked
 * Hackatime project names. Only the project creator can call this.
 *
 * Requires HACKATIME_ADMIN_API_TOKEN to be set server-side. If the token is
 * absent or the user has no hackatimeUserId, responds with an appropriate
 * error so the client can gracefully fall back to manual datetime pickers.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await ctx.params;

  const projectRows = await db
    .select({ id: project.id, creatorId: project.creatorId })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);

  const p = projectRows[0];
  if (!p) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (p.creatorId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date query parameter is required (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  if (!process.env.HACKATIME_ADMIN_API_TOKEN?.trim()) {
    return NextResponse.json(
      { error: "Timeline feature is not configured.", code: "no_admin_token" },
      { status: 503 },
    );
  }

  const userRows = await db
    .select({ hackatimeUserId: user.hackatimeUserId })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const hackatimeUserId = userRows[0]?.hackatimeUserId?.trim() ?? "";
  if (!hackatimeUserId) {
    return NextResponse.json(
      {
        error: "Connect your Hackatime account to use the timeline picker.",
        code: "no_hackatime_user_id",
      },
      { status: 400 },
    );
  }

  const linkedProjects = await listProjectHackatimeProjects(projectId);
  const linkedNameSet = new Set(linkedProjects.map((lp) => lp.name.toLowerCase()));

  try {
    const timeline = await fetchHackatimeAdminTimeline({ date, hackatimeUserId });

    // The API supports multiple user_ids; we only query one, so pick the match.
    const userData = timeline.users.find((u) => String(u.userId) === hackatimeUserId);

    const spans = (userData?.spans ?? []).map((span) => ({
      startTime: span.startTime,
      endTime: span.endTime,
      duration: span.duration,
      projectsEdited: span.projectsEdited,
      editors: span.editors,
      languages: span.languages,
      hasLinkedProject: span.projectsEdited.some((pe) =>
        linkedNameSet.has(pe.name.toLowerCase()),
      ),
    }));

    return NextResponse.json({
      date,
      spans,
      totalCodedTime: userData?.totalCodedTime ?? 0,
      linkedProjectNames: linkedProjects.map((lp) => lp.name),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch timeline.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

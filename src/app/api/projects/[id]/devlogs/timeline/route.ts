import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { listProjectHackatimeProjects } from "@/lib/devlogs";
import { fetchHackatimeAdminTimeline } from "@/lib/hackatime";
import { resolveProjectAccess } from "@/lib/project-route";

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
  const { id: projectId } = await ctx.params;

  const access = await resolveProjectAccess(projectId);
  if ("error" in access) return access.error;
  if (access.project.creatorId !== access.userId) {
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
    .where(eq(user.id, access.userId))
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

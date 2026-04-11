import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { project } from "@/db/schema";
import { refreshHackatimeProjectSnapshotForRange } from "@/lib/hackatime";
import { parseConsideredHackatimeRange } from "@/lib/hackatime-range";
import { getServerSession } from "@/lib/server-session";

type PreviewBody = {
  consideredHackatimeRange?: unknown;
};

function isAdmin(role: unknown): role is "admin" {
  return role === "admin";
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession({ disableCookieCache: true });
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: PreviewBody;
  try {
    body = (await req.json()) as PreviewBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedRange = parseConsideredHackatimeRange(body.consideredHackatimeRange);
  if (!parsedRange.ok) {
    return NextResponse.json({ error: parsedRange.error }, { status: 400 });
  }

  const { id } = await ctx.params;
  const rows = await db
    .select({
      creatorId: project.creatorId,
      hackatimeProjectName: project.hackatimeProjectName,
    })
    .from(project)
    .where(eq(project.id, id))
    .limit(1);

  const current = rows[0];
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!current.creatorId) {
    return NextResponse.json(
      { error: "Project has no creator; cannot refresh the considered Hackatime range." },
      { status: 409 },
    );
  }
  if (!current.hackatimeProjectName.trim()) {
    return NextResponse.json(
      { error: "Project has no Hackatime project name to refresh." },
      { status: 400 },
    );
  }

  try {
    const refreshed = await refreshHackatimeProjectSnapshotForRange(current.creatorId, {
      projectName: current.hackatimeProjectName,
      range: parsedRange.value,
    });
    return NextResponse.json({
      project: {
        hackatimeProjectName: current.hackatimeProjectName,
        hackatimeStartedAt: refreshed.hackatimeStartedAt.toISOString(),
        hackatimeStoppedAt: refreshed.hackatimeStoppedAt.toISOString(),
        hackatimeTotalSeconds: refreshed.hackatimeTotalSeconds,
        hackatimeHours: refreshed.hours,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Failed to refresh Hackatime for the selected range.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

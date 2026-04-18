import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { project, user } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

/**
 * GET /api/projects/[id]/hackatime-stats
 *
 * Reviewer/admin-only. Proxies the public Hackatime stats endpoint:
 *   https://hackatime.hackclub.com/api/v1/users/{slackId}/stats
 *     ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&features=projects
 *
 * Uses the project's startedOnCarnivalAt -> submittedAt window by default
 * (falling back to createdAt -> now when those are not yet set).
 *
 * The caller's Slack ID is looked up on the server so it's not exposed to
 * the browser.
 */

type HackatimeStatsProject = {
  name?: string;
  total_seconds?: number | string;
  human_readable?: string;
  percent?: number | string;
};

type HackatimeStatsResponse = {
  data?: {
    username?: string;
    user_id?: string;
    start?: string;
    end?: string;
    total_seconds?: number | string;
    human_readable_total?: string;
    human_readable_range?: string;
    projects?: HackatimeStatsProject[];
  };
  trust_factor?: {
    trust_level?: string;
    trust_value?: number;
  };
};

function toDateOnly(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function toSafeSeconds(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === "string") {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return 0;
}

function canReview(role: unknown) {
  return role === "reviewer" || role === "admin";
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!canReview(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: projectId } = await ctx.params;

  const projectRows = await db
    .select({
      id: project.id,
      hackatimeProjectName: project.hackatimeProjectName,
      startedOnCarnivalAt: project.startedOnCarnivalAt,
      submittedAt: project.submittedAt,
      createdAt: project.createdAt,
      creatorId: project.creatorId,
    })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);

  const p = projectRows[0];
  if (!p) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!p.creatorId) {
    return NextResponse.json(
      { error: "Project has no creator associated; cannot fetch Hackatime stats." },
      { status: 400 },
    );
  }

  const creatorRows = await db
    .select({ slackId: user.slackId, hackatimeUserId: user.hackatimeUserId })
    .from(user)
    .where(eq(user.id, p.creatorId))
    .limit(1);

  const creator = creatorRows[0];
  const slackId = creator?.slackId?.trim();
  if (!slackId) {
    return NextResponse.json(
      {
        error:
          "The project creator has no Slack ID on file; cannot fetch their Hackatime stats.",
      },
      { status: 400 },
    );
  }

  // Allow caller to override the window via query params (?start=...&end=...).
  const url = new URL(req.url);
  const overrideStart = url.searchParams.get("start");
  const overrideEnd = url.searchParams.get("end");

  const defaultStart = toDateOnly(p.startedOnCarnivalAt ?? p.createdAt);
  const defaultEnd = toDateOnly(p.submittedAt ?? new Date());

  const startDate = toDateOnly(overrideStart) ?? defaultStart;
  const endDate = toDateOnly(overrideEnd) ?? defaultEnd;

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "Could not determine a valid date range for the stats query." },
      { status: 400 },
    );
  }

  const statsUrl = new URL(
    `https://hackatime.hackclub.com/api/v1/users/${encodeURIComponent(slackId)}/stats`,
  );
  statsUrl.searchParams.set("start_date", startDate);
  statsUrl.searchParams.set("end_date", endDate);
  statsUrl.searchParams.set("features", "projects");

  let raw: HackatimeStatsResponse;
  try {
    const response = await fetch(statsUrl.toString(), { cache: "no-store" });
    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      return NextResponse.json(
        {
          error: `Hackatime returned ${response.status} ${response.statusText}`,
          details: bodyText.slice(0, 500) || null,
        },
        { status: 502 },
      );
    }
    raw = (await response.json()) as HackatimeStatsResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to reach Hackatime: ${message}` },
      { status: 502 },
    );
  }

  const rawProjects = Array.isArray(raw.data?.projects) ? raw.data!.projects! : [];
  const projects = rawProjects
    .map((entry) => ({
      name: typeof entry.name === "string" ? entry.name : "",
      totalSeconds: toSafeSeconds(entry.total_seconds),
      humanReadable:
        typeof entry.human_readable === "string" ? entry.human_readable : null,
      percent:
        typeof entry.percent === "number"
          ? entry.percent
          : typeof entry.percent === "string"
            ? Number(entry.percent)
            : null,
    }))
    .filter((entry) => entry.name.length > 0)
    .sort((a, b) => b.totalSeconds - a.totalSeconds);

  const targetName = p.hackatimeProjectName.trim().toLowerCase();
  const matched = projects.find((entry) => entry.name.trim().toLowerCase() === targetName) ?? null;

  return NextResponse.json({
    projectHackatimeName: p.hackatimeProjectName,
    startDate,
    endDate,
    totalSeconds: toSafeSeconds(raw.data?.total_seconds),
    humanReadableTotal:
      typeof raw.data?.human_readable_total === "string"
        ? raw.data.human_readable_total
        : null,
    humanReadableRange:
      typeof raw.data?.human_readable_range === "string"
        ? raw.data.human_readable_range
        : null,
    trustFactor: {
      trustLevel:
        typeof raw.trust_factor?.trust_level === "string"
          ? raw.trust_factor.trust_level
          : null,
      trustValue:
        typeof raw.trust_factor?.trust_value === "number"
          ? raw.trust_factor.trust_value
          : null,
    },
    matchedProject: matched,
    projects,
    creator: {
      slackId,
      hackatimeUserId: creator?.hackatimeUserId ?? null,
    },
  });
}

import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/db/schema";

type DbLike = PostgresJsDatabase<typeof schema>;

// ============================================================================
// Types
// ============================================================================

export type ActivationFunnel = {
  totalUsers: number;
  hackatimeConnected: number;
  hasProject: number;
  hasSubmitted: number;
  hasGrant: number;
};

export type WeeklySignupPoint = {
  weekStartIso: string;
  signups: number;
};

export const SEGMENT_KEYS = [
  "never_activated",
  "zero_hours",
  "stalled_with_hours",
  "verification_blocked",
] as const;

export type SegmentKey = (typeof SEGMENT_KEYS)[number];

export function isSegmentKey(value: unknown): value is SegmentKey {
  return typeof value === "string" && (SEGMENT_KEYS as readonly string[]).includes(value);
}

export type SegmentUser = {
  id: string;
  name: string | null;
  email: string;
  slackId: string | null;
  verificationStatus: string | null;
  createdAtIso: string;
  lastNudgedAtIso: string | null;
  // Segment-specific extras (present when relevant, otherwise null).
  projectCount: number | null;
  stalledSeconds: number | null;
  topProjectName: string | null;
  hasShippedOrGranted: boolean | null;
};

export type ActivationSegments = Record<SegmentKey, SegmentUser[]>;

// ============================================================================
// Pure helpers (unit tested)
// ============================================================================

export function firstNameOf(name: string | null | undefined): string {
  const cleaned = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  const first = cleaned.split(" ")[0] ?? "";
  return first || "there";
}

/** Replace supported placeholders ({firstName}) in a nudge template. */
export function renderNudgeMessage(template: string, user: { name: string | null }): string {
  return template.replaceAll("{firstName}", firstNameOf(user.name));
}

export function isRecentlyNudged(
  lastNudgedAtIso: string | null,
  now: Date,
  withinDays: number,
): boolean {
  if (!lastNudgedAtIso || withinDays <= 0) return false;
  const at = Date.parse(lastNudgedAtIso);
  if (!Number.isFinite(at)) return false;
  return now.getTime() - at < withinDays * 24 * 60 * 60 * 1000;
}

export type NudgeTemplate = {
  key: SegmentKey;
  label: string;
  description: string;
  template: string;
};

export function buildNudgeTemplates(appBaseUrl: string): Record<SegmentKey, NudgeTemplate> {
  const base = appBaseUrl.replace(/\/+$/, "");
  return {
    never_activated: {
      key: "never_activated",
      label: "Never activated",
      description: "Signed up but never connected Hackatime or created a project.",
      template: [
        "Hey {firstName}! 🎪 You signed up for Carnival but haven't gotten rolling yet.",
        "It takes ~5 minutes to start: connect Hackatime so your coding time counts, then create your first project.",
        `Start here: ${base}/account`,
        "Build something, ship it, and get a grant to upgrade your dev setup!",
      ].join("\n"),
    },
    zero_hours: {
      key: "zero_hours",
      label: "Project but no hours",
      description: "Created a project but Hackatime has recorded zero time — likely a plugin setup issue.",
      template: [
        "Hey {firstName}! 🎪 You created a project on Carnival, but Hackatime hasn't recorded any coding time on it yet.",
        "That usually means the editor plugin isn't set up (or the project name doesn't match).",
        `Double-check your setup here: ${base}/account — and make sure your Hackatime project name matches your Carnival project.`,
        "Reply here if you're stuck and we'll help you get unblocked!",
      ].join("\n"),
    },
    stalled_with_hours: {
      key: "stalled_with_hours",
      label: "Hours logged, not submitted",
      description: "Has real hours on a work-in-progress project but hasn't submitted it for review.",
      template: [
        "Hey {firstName}! 🎪 You've got real hours logged on your Carnival project — you're closer to a grant than you think.",
        "Post a devlog if you haven't, then hit submit so a reviewer can take a look.",
        `Your projects: ${base}/projects`,
        "Don't leave those hours on the table!",
      ].join("\n"),
    },
    verification_blocked: {
      key: "verification_blocked",
      label: "Verification incomplete",
      description: "Building projects but identity verification is not finished — grants can't be paid out.",
      template: [
        "Hey {firstName}! 🎪 Quick heads up: your Hack Club identity verification isn't finished, which means we can't pay out your Carnival grant when your project ships.",
        "It only takes a couple of minutes: https://identity.hackclub.com",
        "Finish it now so nothing blocks your payout later!",
      ].join("\n"),
    },
  };
}

// ============================================================================
// Queries
// ============================================================================

function toInt(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? Number(n) : 0;
}

function toIsoOrNull(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const t = Date.parse(value);
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
  }
  return null;
}

export async function getActivationFunnel(db: DbLike): Promise<ActivationFunnel> {
  const result = await db.execute(sql`
    select
      count(*)::int as total_users,
      count(*) filter (where u.hackatime_connected_at is not null)::int as hackatime_connected,
      count(*) filter (where exists (select 1 from project p where p.creator_id = u.id))::int as has_project,
      count(*) filter (where exists (select 1 from project p where p.creator_id = u.id and p.submitted_at is not null))::int as has_submitted,
      count(*) filter (where exists (select 1 from project p where p.creator_id = u.id and p.status = 'granted'))::int as has_grant
    from "user" u
  `);
  const row = (result as unknown as Record<string, unknown>[])[0] ?? {};
  return {
    totalUsers: toInt(row.total_users),
    hackatimeConnected: toInt(row.hackatime_connected),
    hasProject: toInt(row.has_project),
    hasSubmitted: toInt(row.has_submitted),
    hasGrant: toInt(row.has_grant),
  };
}

export async function getWeeklySignups(db: DbLike, weeks = 12): Promise<WeeklySignupPoint[]> {
  const result = await db.execute(sql`
    select date_trunc('week', u.created_at)::date as week_start, count(*)::int as signups
    from "user" u
    where u.created_at > now() - make_interval(weeks => ${weeks})
    group by 1
    order by 1
  `);
  return (result as unknown as Record<string, unknown>[]).map((row) => ({
    weekStartIso: toIsoOrNull(row.week_start) ?? "",
    signups: toInt(row.signups),
  }));
}

const SEGMENT_USER_COLUMNS = sql`
  u.id,
  u.name,
  u.email,
  u.slack_id,
  u.verification_status,
  u.created_at,
  (select max(n.created_at) from user_nudge n where n.user_id = u.id) as last_nudged_at
`;

function mapSegmentUser(row: Record<string, unknown>): SegmentUser {
  return {
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : null,
    email: String(row.email ?? ""),
    slackId: typeof row.slack_id === "string" && row.slack_id ? row.slack_id : null,
    verificationStatus:
      typeof row.verification_status === "string" && row.verification_status
        ? row.verification_status
        : null,
    createdAtIso: toIsoOrNull(row.created_at) ?? "",
    lastNudgedAtIso: toIsoOrNull(row.last_nudged_at),
    projectCount: row.project_count === undefined ? null : toInt(row.project_count),
    stalledSeconds: row.stalled_seconds === undefined ? null : toInt(row.stalled_seconds),
    topProjectName:
      typeof row.top_project_name === "string" && row.top_project_name
        ? row.top_project_name
        : null,
    hasShippedOrGranted:
      row.has_shipped_or_granted === undefined ? null : Boolean(row.has_shipped_or_granted),
  };
}

export async function getActivationSegments(db: DbLike): Promise<ActivationSegments> {
  const [neverActivated, zeroHours, stalledWithHours, verificationBlocked] = await Promise.all([
    db.execute(sql`
      select ${SEGMENT_USER_COLUMNS}
      from "user" u
      where u.hackatime_connected_at is null
        and not exists (select 1 from project p where p.creator_id = u.id)
      order by u.created_at desc
    `),
    db.execute(sql`
      select ${SEGMENT_USER_COLUMNS},
        (select count(*)::int from project p where p.creator_id = u.id) as project_count
      from "user" u
      where exists (select 1 from project p where p.creator_id = u.id)
        and not exists (
          select 1 from project p
          where p.creator_id = u.id
            and (p.hours_spent_seconds > 0 or p.status <> 'work-in-progress' or p.submitted_at is not null)
        )
      order by u.created_at desc
    `),
    db.execute(sql`
      select ${SEGMENT_USER_COLUMNS},
        agg.stalled_seconds,
        agg.top_project_name,
        exists (
          select 1 from project p2
          where p2.creator_id = u.id and p2.status in ('shipped', 'granted')
        ) as has_shipped_or_granted
      from "user" u
      join lateral (
        select
          coalesce(sum(p.hours_spent_seconds), 0)::int as stalled_seconds,
          (array_agg(p.name order by p.hours_spent_seconds desc))[1] as top_project_name
        from project p
        where p.creator_id = u.id
          and p.status = 'work-in-progress'
          and p.submitted_at is null
          and p.hours_spent_seconds > 0
      ) agg on true
      where agg.stalled_seconds > 0
      order by agg.stalled_seconds desc
    `),
    db.execute(sql`
      select ${SEGMENT_USER_COLUMNS},
        (select count(*)::int from project p where p.creator_id = u.id) as project_count
      from "user" u
      where u.verification_status in ('needs_submission', 'pending')
        and exists (select 1 from project p where p.creator_id = u.id)
      order by u.created_at desc
    `),
  ]);

  const mapRows = (rows: unknown) =>
    (rows as unknown as Record<string, unknown>[]).map(mapSegmentUser);

  return {
    never_activated: mapRows(neverActivated),
    zero_hours: mapRows(zeroHours),
    stalled_with_hours: mapRows(stalledWithHours),
    verification_blocked: mapRows(verificationBlocked),
  };
}

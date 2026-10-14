/**
 * Candidate selection for automated nudges (DB half). One raw-SQL query per
 * kind (same style as src/lib/insights.ts) sharing the `eligible` CTE below.
 *
 * Common exclusions, every kind: frozen accounts, no Slack ID, opted out,
 * and anyone with a project currently in review (they're waiting on us).
 * The planner (policy.ts) then applies history/cooldowns and priority.
 */
import { desc, inArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/db/schema";
import { userNudge } from "@/db/schema";
import type { NudgeKind, NudgeVariant } from "./kinds";
import type { NudgeCandidate, NudgeHistoryEntry } from "./policy";

type DbLike = PostgresJsDatabase<typeof schema>;

export const NUDGE_SELECTION_WINDOWS = {
  /** A project counts as stalled when no devlog was posted in this many days. */
  stalledDevlogDays: 5,
  /** project_no_hours_7d: project age. */
  projectAgeDays: 7,
  /** Setup nudges: account age. */
  accountAgeDays: 3,
} as const;

const ELIGIBLE_CTE = sql`
  eligible as (
    select
      u.id,
      u.name,
      u.slack_id,
      u.created_at,
      (u.hackatime_access_token is not null and u.hackatime_access_token <> '') as has_token,
      u.hackatime_connected_at
    from "user" u
    where not u.is_frozen
      and u.slack_id is not null and u.slack_id <> ''
      and not u.slack_nudges_opt_out
      and not exists (select 1 from project p where p.creator_id = u.id and p.status = 'in-review')
  )
`;

/**
 * Compare against `timestamp` (without time zone) columns, which Drizzle
 * writes as UTC wall-clock values: pass the same UTC wall-clock literal and
 * cast, so the session time zone never shifts the comparison.
 */
function utcTimestampParam(date: Date) {
  return sql`${date.toISOString().replace("Z", "")}::timestamp`;
}

function toInt(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? Number(n) : 0;
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const t = Date.parse(value);
    if (Number.isFinite(t)) return new Date(t).toISOString();
  }
  return "";
}

function toBool(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1;
}

type Row = Record<string, unknown>;

function baseCandidate(row: Row, kind: NudgeKind, variant: NudgeVariant): NudgeCandidate {
  return {
    userId: String(row.id),
    name: typeof row.name === "string" ? row.name : null,
    slackId: String(row.slack_id),
    createdAtIso: toIso(row.created_at),
    kind,
    variant,
    projectId: typeof row.project_id === "string" ? row.project_id : null,
    projectName: typeof row.project_name === "string" ? row.project_name : null,
    devlogSeconds: toInt(row.devlog_seconds),
    hackatimeSeconds: row.hackatime_seconds == null ? null : toInt(row.hackatime_seconds),
  };
}

export async function loadNudgeCandidates(db: DbLike, now: Date): Promise<NudgeCandidate[]> {
  const stalledBefore = new Date(now.getTime() - NUDGE_SELECTION_WINDOWS.stalledDevlogDays * 86_400_000);
  const projectCreatedBefore = new Date(now.getTime() - NUDGE_SELECTION_WINDOWS.projectAgeDays * 86_400_000);
  const accountCreatedBefore = new Date(now.getTime() - NUDGE_SELECTION_WINDOWS.accountAgeDays * 86_400_000);

  const [hoursUnsubmitted, projectNoHours, connectedNoProject, neverConnected] = await Promise.all([
    // Kind 1: devlog hours on a stalled, never-submitted WIP project. Repeat
    // shippers stay in (different copy): they're the likeliest to submit.
    db.execute(sql`
      with ${ELIGIBLE_CTE}
      select e.id, e.name, e.slack_id, e.created_at,
        p.id as project_id, p.name as project_name,
        p.hours_spent_seconds as devlog_seconds, p.hackatime_total_seconds as hackatime_seconds,
        exists (
          select 1 from project p2 where p2.creator_id = e.id and p2.status in ('shipped', 'granted')
        ) as has_shipped
      from eligible e
      join lateral (
        select p.id, p.name, p.hours_spent_seconds, p.hackatime_total_seconds
        from project p
        where p.creator_id = e.id
          and p.status = 'work-in-progress'
          and p.submitted_at is null
          and not p.resubmission_blocked
          and p.hours_spent_seconds > 0
          and not exists (
            select 1 from devlog d where d.project_id = p.id and d.created_at > ${utcTimestampParam(stalledBefore)}
          )
        order by p.hours_spent_seconds desc
        limit 1
      ) p on true
    `),
    // Kind 2: week-old WIP project with zero devlog hours; never shipped.
    db.execute(sql`
      with ${ELIGIBLE_CTE}
      select e.id, e.name, e.slack_id, e.created_at, e.has_token,
        p.id as project_id, p.name as project_name,
        0 as devlog_seconds, p.hackatime_total_seconds as hackatime_seconds
      from eligible e
      join lateral (
        select p.id, p.name, p.hackatime_total_seconds
        from project p
        where p.creator_id = e.id
          and p.status = 'work-in-progress'
          and p.submitted_at is null
          and not p.resubmission_blocked
          and p.hours_spent_seconds = 0
          and p.created_at <= ${utcTimestampParam(projectCreatedBefore)}
          and not exists (
            select 1 from devlog d where d.project_id = p.id and d.created_at > ${utcTimestampParam(stalledBefore)}
          )
        order by p.created_at asc
        limit 1
      ) p on true
      where not exists (
        select 1 from project p2 where p2.creator_id = e.id and p2.status in ('shipped', 'granted')
      )
    `),
    // Kind 3: Hackatime connected, no project.
    db.execute(sql`
      with ${ELIGIBLE_CTE}
      select e.id, e.name, e.slack_id, e.created_at
      from eligible e
      where e.has_token
        and e.created_at <= ${utcTimestampParam(accountCreatedBefore)}
        and not exists (select 1 from project p where p.creator_id = e.id)
    `),
    // Kind 4: no Hackatime token, no project.
    db.execute(sql`
      with ${ELIGIBLE_CTE}
      select e.id, e.name, e.slack_id, e.created_at, e.hackatime_connected_at
      from eligible e
      where not e.has_token
        and e.created_at <= ${utcTimestampParam(accountCreatedBefore)}
        and not exists (select 1 from project p where p.creator_id = e.id)
    `),
  ]);

  const rows = (result: unknown) => result as unknown as Row[];
  const candidates: NudgeCandidate[] = [];

  for (const row of rows(hoursUnsubmitted)) {
    candidates.push(
      baseCandidate(row, "hours_unsubmitted", toBool(row.has_shipped) ? "repeat_shipper" : "default"),
    );
  }
  for (const row of rows(projectNoHours)) {
    const variant: NudgeVariant = !toBool(row.has_token)
      ? "no_token"
      : toInt(row.hackatime_seconds) > 0
        ? "has_hackatime_time"
        : "no_hackatime_time";
    candidates.push(baseCandidate(row, "project_no_hours_7d", variant));
  }
  for (const row of rows(connectedNoProject)) {
    candidates.push(baseCandidate(row, "connected_no_project", "default"));
  }
  for (const row of rows(neverConnected)) {
    candidates.push(
      baseCandidate(row, "never_connected", row.hackatime_connected_at ? "needs_reconnect" : "default"),
    );
  }
  return candidates;
}

/** Every user_nudge row (manual and automated) for the given users. */
export async function loadNudgeHistory(
  db: DbLike,
  userIds: string[],
): Promise<Map<string, NudgeHistoryEntry[]>> {
  const map = new Map<string, NudgeHistoryEntry[]>();
  if (userIds.length === 0) return map;
  const rows = await db
    .select({ userId: userNudge.userId, kind: userNudge.kind, createdAt: userNudge.createdAt })
    .from(userNudge)
    .where(inArray(userNudge.userId, userIds))
    .orderBy(desc(userNudge.createdAt));
  for (const row of rows) {
    const userId = row.userId;
    const entry: NudgeHistoryEntry = { kind: row.kind, createdAtIso: row.createdAt.toISOString() };
    const list = map.get(userId);
    if (list) list.push(entry);
    else map.set(userId, [entry]);
  }
  return map;
}

export type AutomatedNudgeStats = {
  kind: string;
  sent: number;
  lastSentAtIso: string | null;
};

/** Per-kind totals of automated sends so far (sent_by_user_id is null). */
export async function loadAutomatedNudgeStats(db: DbLike): Promise<AutomatedNudgeStats[]> {
  const result = await db.execute(sql`
    select n.kind, count(*)::int as sent, max(n.created_at) as last_sent_at
    from user_nudge n
    where n.sent_by_user_id is null and n.channel = 'slack'
    group by n.kind
    order by n.kind
  `);
  return (result as unknown as Row[]).map((row) => ({
    kind: String(row.kind ?? ""),
    sent: toInt(row.sent),
    lastSentAtIso: row.last_sent_at ? toIso(row.last_sent_at) : null,
  }));
}

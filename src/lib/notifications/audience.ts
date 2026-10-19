/**
 * Audience filters (DB half): turns the fixed filter list from
 * audience-shared.ts into one query over users and their project totals.
 * Column names come from a whitelist; every value is a bound parameter.
 */
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import type { AudienceFilter, NumberOp } from "./audience-shared";

const NUMBER_COLUMNS = {
  projects_created: sql`a.projects_created`,
  projects_submitted: sql`a.projects_submitted`,
  projects_shipped: sql`a.projects_shipped`,
  approved_hours: sql`a.approved_hours`,
  logged_hours: sql`a.logged_hours`,
  unsubmitted_hours: sql`a.unsubmitted_hours`,
} as const;

const OPERATORS: Record<NumberOp, SQL> = {
  gte: sql.raw(">="),
  gt: sql.raw(">"),
  eq: sql.raw("="),
  lte: sql.raw("<="),
  lt: sql.raw("<"),
};

function filterCondition(f: AudienceFilter): SQL {
  switch (f.key) {
    case "projects_created":
    case "projects_submitted":
    case "projects_shipped":
    case "approved_hours":
    case "logged_hours":
    case "unsubmitted_hours":
      // Hours are compared at one decimal, the precision they're shown at.
      return sql`${NUMBER_COLUMNS[f.key]} ${OPERATORS[f.op]} ${f.value}`;
    case "in_review":
      return sql`a.in_review = ${f.value}`;
    case "hackatime_connected":
      return f.value ? sql`a.hackatime_connected_at is not null` : sql`a.hackatime_connected_at is null`;
    case "verification": {
      const named = f.values.filter((v) => v !== "none");
      const parts: SQL[] = [];
      if (named.length) parts.push(sql`a.verification_status in (${sql.join(named.map((v) => sql`${v}`), sql`, `)})`);
      if (f.values.includes("none")) parts.push(sql`(a.verification_status is null or a.verification_status = '')`);
      return sql`(${sql.join(parts, sql` or `)})`;
    }
    case "signed_up": {
      // Signup times are stored in UTC; "after" includes the day itself.
      const day = `${f.date} 00:00:00`;
      return f.op === "before" ? sql`a.created_at < ${day}::timestamp` : sql`a.created_at >= ${day}::timestamp`;
    }
  }
}

/** IDs of every user matching all the filters (no filters: everyone), newest signups first. */
export async function findAudience(filters: AudienceFilter[]): Promise<string[]> {
  const where = filters.length ? sql`where ${sql.join(filters.map(filterCondition), sql` and `)}` : sql``;
  const rows = await db.execute(sql`
    select a.id from (
      select
        u.id,
        u.created_at,
        u.verification_status,
        u.hackatime_connected_at,
        coalesce(p.projects_created, 0) as projects_created,
        coalesce(p.projects_submitted, 0) as projects_submitted,
        coalesce(p.projects_shipped, 0) as projects_shipped,
        round(coalesce(p.approved_hours, 0)::numeric, 1) as approved_hours,
        round(coalesce(p.logged_seconds, 0)::numeric / 3600, 1) as logged_hours,
        round(coalesce(p.unsubmitted_seconds, 0)::numeric / 3600, 1) as unsubmitted_hours,
        coalesce(p.in_review, false) as in_review
      from "user" u
      left join lateral (
        select
          count(*)::int as projects_created,
          count(*) filter (where pr.status <> 'work-in-progress' or pr.submitted_at is not null)::int as projects_submitted,
          count(*) filter (where pr.status in ('shipped', 'granted'))::int as projects_shipped,
          sum(pr.approved_hours) as approved_hours,
          sum(pr.hours_spent_seconds) as logged_seconds,
          sum(pr.hours_spent_seconds) filter (
            where pr.status = 'work-in-progress' and pr.submitted_at is null
          ) as unsubmitted_seconds,
          bool_or(pr.status = 'in-review') as in_review
        from project pr
        where pr.creator_id = u.id
      ) p on true
    ) a
    ${where}
    order by a.created_at desc
  `);
  return (rows as unknown as { id: string }[]).map((r) => String(r.id));
}

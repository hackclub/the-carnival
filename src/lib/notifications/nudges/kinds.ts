/**
 * Automated nudge kinds. Pure constants and helpers (no DB/Slack imports) so
 * the policy and copy can be unit tested.
 *
 * Priority order matters: a user can qualify for several kinds at once and
 * receives only the first one in this list per run. "Closest to a grant"
 * comes first.
 */

export const NUDGE_KINDS = [
  // WIP project with devlog hours, never submitted, no devlog in 5 days.
  "hours_unsubmitted",
  // WIP project >= 7 days old with zero devlog hours (setup never completed).
  "project_no_hours_7d",
  // Hackatime connected, no project yet.
  "connected_no_project",
  // Never connected Hackatime (or token revoked), no project.
  "never_connected",
] as const;

export type NudgeKind = (typeof NUDGE_KINDS)[number];

export function isNudgeKind(value: unknown): value is NudgeKind {
  return typeof value === "string" && (NUDGE_KINDS as readonly string[]).includes(value);
}

export function nudgeKindPriority(kind: NudgeKind): number {
  return NUDGE_KINDS.indexOf(kind);
}

/**
 * Copy variants within a kind. Selection lives in select.ts (from DB facts);
 * templates.ts renders each.
 */
export type NudgeVariant =
  | "default"
  // hours_unsubmitted: the user already shipped something before.
  | "repeat_shipper"
  // project_no_hours_7d: no Hackatime token stored (never connected / revoked).
  | "no_token"
  // project_no_hours_7d: Hackatime has time on the project but no devlog yet.
  | "has_hackatime_time"
  // project_no_hours_7d: Hackatime shows nothing on the project (plugin / name issue).
  | "no_hackatime_time"
  // never_connected: connected once, token since revoked.
  | "needs_reconnect";

export const NUDGE_KIND_META: Record<NudgeKind, { label: string; description: string }> = {
  hours_unsubmitted: {
    label: "Hours logged, not submitted",
    description: "Devlog hours on a work-in-progress project, no devlog in 5 days, never submitted.",
  },
  project_no_hours_7d: {
    label: "Project, no hours (7+ days)",
    description: "Created a project at least a week ago with zero devlog hours; never shipped anything.",
  },
  connected_no_project: {
    label: "Hackatime connected, no project",
    description: "Connected Hackatime at least 3 days ago but never created a project.",
  },
  never_connected: {
    label: "Never connected Hackatime",
    description: "Joined at least 3 days ago, no Hackatime token, no project.",
  },
};

/**
 * Automated sends are recorded in the same user_nudge table as admin nudges,
 * with sent_by_user_id = null and this prefix on `kind`, so the two are
 * distinguishable while every cooldown check sees both.
 */
const STORED_KIND_PREFIX = "auto_";

export function toStoredNudgeKind(kind: NudgeKind): string {
  return `${STORED_KIND_PREFIX}${kind}`;
}

export function fromStoredNudgeKind(stored: string): NudgeKind | null {
  if (!stored.startsWith(STORED_KIND_PREFIX)) return null;
  const kind = stored.slice(STORED_KIND_PREFIX.length);
  return isNudgeKind(kind) ? kind : null;
}

export type NudgePolicy = {
  /** Minimum days between two automated sends of the same kind to one user. */
  cooldownDays: number;
  /** Lifetime cap of automated sends per kind per user. */
  maxSendsPerKind: number;
  /** No automated send to a user nudged by anyone (admin or bot) this recently. */
  globalQuietDays: number;
};

export const DEFAULT_NUDGE_POLICY: NudgePolicy = {
  cooldownDays: 6,
  maxSendsPerKind: 2,
  globalQuietDays: 7,
};

/**
 * Default sends per call of /api/cron/nudges. Sends are paced at 1 msg/s and
 * the app sits behind Cloudflare, which drops responses after 100 s, so one
 * call must stay well under that; the workflow loops several calls per day
 * instead (people already sent fall into the quiet window on the next call).
 */
export const DEFAULT_NUDGES_MAX_PER_RUN = 80;

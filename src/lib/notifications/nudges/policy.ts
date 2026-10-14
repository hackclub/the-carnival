/**
 * Pure planning logic for an automated nudge run. Given candidates (from
 * select.ts) and each user's nudge history, decide who gets which message
 * today. No DB or Slack imports; see policy.test.mjs.
 */
import {
  DEFAULT_NUDGE_POLICY,
  nudgeKindPriority,
  toStoredNudgeKind,
  type NudgeKind,
  type NudgePolicy,
  type NudgeVariant,
} from "./kinds";

export type NudgeCandidate = {
  userId: string;
  name: string | null;
  slackId: string;
  createdAtIso: string;
  kind: NudgeKind;
  variant: NudgeVariant;
  // Project context when the kind is about one project.
  projectId: string | null;
  projectName: string | null;
  devlogSeconds: number;
  hackatimeSeconds: number | null;
};

/** One user_nudge row (manual or automated). */
export type NudgeHistoryEntry = {
  kind: string;
  createdAtIso: string;
};

export type PlannedNudge = NudgeCandidate & {
  /** 1 for the first automated send of this kind, 2 for the "last call". */
  sendNumber: number;
  storedKind: string;
};

export type NudgeSkipReason =
  | "deadline_passed"
  | "recently_nudged"
  | "kind_cooldown"
  | "kind_cap_reached"
  | "not_in_allowlist"
  | "over_run_cap";

export type SkippedNudge = { userId: string; kind: NudgeKind; reason: NudgeSkipReason };

const DAY_MS = 24 * 60 * 60 * 1000;

function parseMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : Number.NaN;
}

function withinDays(iso: string, now: Date, days: number): boolean {
  if (days <= 0) return false;
  const t = parseMs(iso);
  if (!Number.isFinite(t)) return false;
  return now.getTime() - t < days * DAY_MS;
}

/** Whole days until the deadline (negative once passed); null when unknown. */
export function daysUntil(deadlineIso: string | null, now: Date): number | null {
  if (!deadlineIso) return null;
  const t = parseMs(deadlineIso);
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - now.getTime()) / DAY_MS);
}

export function isDeadlinePassed(deadlineIso: string | null, now: Date): boolean {
  if (!deadlineIso) return false;
  const t = parseMs(deadlineIso);
  return Number.isFinite(t) && now.getTime() >= t;
}

/**
 * Choose at most one nudge for a user from every kind they qualify for.
 * Highest-priority kind wins; the history then decides whether it can go out.
 */
export function pickNudgeForUser(
  candidates: NudgeCandidate[],
  history: NudgeHistoryEntry[],
  now: Date,
  policy: NudgePolicy = DEFAULT_NUDGE_POLICY,
): { planned: PlannedNudge } | { skipped: SkippedNudge } | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => nudgeKindPriority(a.kind) - nudgeKindPriority(b.kind));
  const candidate = sorted[0];
  const storedKind = toStoredNudgeKind(candidate.kind);
  const skip = (reason: NudgeSkipReason) => ({
    skipped: { userId: candidate.userId, kind: candidate.kind, reason },
  });

  if (history.some((h) => withinDays(h.createdAtIso, now, policy.globalQuietDays))) {
    return skip("recently_nudged");
  }

  const sameKind = history.filter((h) => h.kind === storedKind);
  if (sameKind.length >= policy.maxSendsPerKind) return skip("kind_cap_reached");
  if (sameKind.some((h) => withinDays(h.createdAtIso, now, policy.cooldownDays))) {
    return skip("kind_cooldown");
  }

  return { planned: { ...candidate, sendNumber: sameKind.length + 1, storedKind } };
}

export type NudgeRunPlan = {
  planned: PlannedNudge[];
  skipped: SkippedNudge[];
};

/**
 * Plan a whole run: one nudge per user, deadline stop, optional allowlist
 * (test mode), and a per-run cap applied in priority order so day one of a
 * campaign clears the high-intent kinds before the long tail.
 */
export function planNudgeRun(input: {
  candidates: NudgeCandidate[];
  historyByUser: Map<string, NudgeHistoryEntry[]>;
  now: Date;
  deadlineIso: string | null;
  maxSends: number;
  allowlist?: Set<string> | null;
  policy?: NudgePolicy;
}): NudgeRunPlan {
  const policy = input.policy ?? DEFAULT_NUDGE_POLICY;
  const skipped: SkippedNudge[] = [];

  if (isDeadlinePassed(input.deadlineIso, input.now)) {
    for (const c of input.candidates) {
      skipped.push({ userId: c.userId, kind: c.kind, reason: "deadline_passed" });
    }
    return { planned: [], skipped };
  }

  const byUser = new Map<string, NudgeCandidate[]>();
  for (const c of input.candidates) {
    const list = byUser.get(c.userId);
    if (list) list.push(c);
    else byUser.set(c.userId, [c]);
  }

  const eligible: PlannedNudge[] = [];
  for (const [userId, list] of byUser) {
    const pick = pickNudgeForUser(list, input.historyByUser.get(userId) ?? [], input.now, policy);
    if (!pick) continue;
    if ("skipped" in pick) {
      skipped.push(pick.skipped);
      continue;
    }
    if (input.allowlist && !input.allowlist.has(pick.planned.slackId)) {
      skipped.push({ userId, kind: pick.planned.kind, reason: "not_in_allowlist" });
      continue;
    }
    eligible.push(pick.planned);
  }

  eligible.sort((a, b) => {
    const byKind = nudgeKindPriority(a.kind) - nudgeKindPriority(b.kind);
    if (byKind !== 0) return byKind;
    const byJoined = parseMs(a.createdAtIso) - parseMs(b.createdAtIso);
    if (Number.isFinite(byJoined) && byJoined !== 0) return byJoined;
    return a.userId.localeCompare(b.userId);
  });

  const cap = Math.max(0, Math.floor(input.maxSends));
  const planned = eligible.slice(0, cap);
  for (const over of eligible.slice(cap)) {
    skipped.push({ userId: over.userId, kind: over.kind, reason: "over_run_cap" });
  }
  return { planned, skipped };
}

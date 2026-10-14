/**
 * One automated nudge run: select → plan → (optionally) send and record.
 *
 * Safety rails, in order:
 * - NUDGES_ENABLED must be "true" or the run is forced to dry-run;
 * - the run stops entirely once carnival_deadline has passed;
 * - NUDGES_TEST_SLACK_IDS, when set, restricts sends to those Slack IDs;
 * - NUDGES_MAX_PER_RUN caps sends (1 msg/s pacing → keep under maxDuration);
 * - each successful send is recorded in user_nudge IMMEDIATELY, so a timeout
 *   mid-run can never cause a re-send tomorrow.
 */
import { randomUUID } from "crypto";
import { db } from "@/db";
import { userNudge } from "@/db/schema";
import { getAppBaseUrl } from "@/lib/loops";
import { getSiteSettingIso } from "@/lib/site-settings";
import { sendNudgeDM } from "../review-events";
import { isSlackConfigured } from "../slack-client";
import { DEFAULT_NUDGES_MAX_PER_RUN, NUDGE_KINDS, type NudgeKind } from "./kinds";
import { daysUntil, planNudgeRun, type NudgeSkipReason, type PlannedNudge } from "./policy";
import { loadNudgeCandidates, loadNudgeHistory } from "./select";
import { buildNudgeText } from "./templates";

export function isNudgeSendingEnabled(): boolean {
  const v = process.env.NUDGES_ENABLED?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

export function nudgeAllowlistFromEnv(): string[] | null {
  const raw = process.env.NUDGES_TEST_SLACK_IDS?.trim();
  if (!raw) return null;
  const ids = raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  return ids.length ? ids : null;
}

export function nudgeMaxPerRunFromEnv(): number {
  const n = Number(process.env.NUDGES_MAX_PER_RUN);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_NUDGES_MAX_PER_RUN;
}

export type NudgeRunOptions = {
  dryRun: boolean;
  now?: Date;
  maxSends?: number;
  allowlist?: string[] | null;
};

export type PlannedNudgeSummary = {
  userId: string;
  name: string | null;
  slackId: string;
  kind: NudgeKind;
  variant: string;
  sendNumber: number;
  projectName: string | null;
  devlogSeconds: number;
};

export type NudgeRunResult = {
  dryRun: boolean;
  sendingEnabled: boolean;
  slackConfigured: boolean;
  nowIso: string;
  deadlineIso: string | null;
  daysLeft: number | null;
  maxSends: number;
  allowlist: string[] | null;
  candidatesByKind: Record<NudgeKind, number>;
  plannedByKind: Record<NudgeKind, number>;
  skippedByReason: Partial<Record<NudgeSkipReason, number>>;
  planned: PlannedNudgeSummary[];
  sent: PlannedNudgeSummary[];
  failed: PlannedNudgeSummary[];
  /** Rendered copy for the first few planned nudges (dry-run preview). */
  samples: { kind: NudgeKind; variant: string; text: string }[];
};

function emptyByKind(): Record<NudgeKind, number> {
  return Object.fromEntries(NUDGE_KINDS.map((k) => [k, 0])) as Record<NudgeKind, number>;
}

function summarize(n: PlannedNudge): PlannedNudgeSummary {
  return {
    userId: n.userId,
    name: n.name,
    slackId: n.slackId,
    kind: n.kind,
    variant: n.variant,
    sendNumber: n.sendNumber,
    projectName: n.projectName,
    devlogSeconds: n.devlogSeconds,
  };
}

export async function runNudges(options: NudgeRunOptions): Promise<NudgeRunResult> {
  const now = options.now ?? new Date();
  const sendingEnabled = isNudgeSendingEnabled();
  const slackConfigured = isSlackConfigured();
  const dryRun = options.dryRun || !sendingEnabled || !slackConfigured;
  const maxSends = options.maxSends ?? nudgeMaxPerRunFromEnv();
  const allowlist = options.allowlist === undefined ? nudgeAllowlistFromEnv() : options.allowlist;

  const deadlineIso = await getSiteSettingIso("carnival_deadline");
  const daysLeft = daysUntil(deadlineIso, now);

  const candidates = await loadNudgeCandidates(db, now);
  const historyByUser = await loadNudgeHistory(db, [...new Set(candidates.map((c) => c.userId))]);
  const plan = planNudgeRun({
    candidates,
    historyByUser,
    now,
    deadlineIso,
    maxSends,
    allowlist: allowlist ? new Set(allowlist) : null,
  });

  const candidatesByKind = emptyByKind();
  for (const c of candidates) candidatesByKind[c.kind] += 1;
  const plannedByKind = emptyByKind();
  for (const p of plan.planned) plannedByKind[p.kind] += 1;
  const skippedByReason: Partial<Record<NudgeSkipReason, number>> = {};
  for (const s of plan.skipped) skippedByReason[s.reason] = (skippedByReason[s.reason] ?? 0) + 1;

  const ctx = { appBaseUrl: getAppBaseUrl(), deadlineIso, daysLeft };
  const seenSampleKeys = new Set<string>();
  const samples: NudgeRunResult["samples"] = [];
  for (const p of plan.planned) {
    const key = `${p.kind}:${p.variant}:${p.sendNumber}`;
    if (seenSampleKeys.has(key)) continue;
    seenSampleKeys.add(key);
    samples.push({ kind: p.kind, variant: p.variant, text: buildNudgeText(p, ctx) });
  }

  const result: NudgeRunResult = {
    dryRun,
    sendingEnabled,
    slackConfigured,
    nowIso: now.toISOString(),
    deadlineIso,
    daysLeft,
    maxSends,
    allowlist,
    candidatesByKind,
    plannedByKind,
    skippedByReason,
    planned: plan.planned.map(summarize),
    sent: [],
    failed: [],
    samples,
  };
  if (dryRun) return result;

  for (const nudge of plan.planned) {
    const text = buildNudgeText(nudge, ctx);
    const ok = await sendNudgeDM(nudge.slackId, text);
    if (!ok) {
      result.failed.push(summarize(nudge));
      continue;
    }
    // Record right away: a later failure or timeout must not re-send this.
    try {
      await db.insert(userNudge).values({
        id: randomUUID(),
        userId: nudge.userId,
        channel: "slack",
        kind: nudge.storedKind,
        message: text,
        sentByUserId: null,
        createdAt: new Date(),
      });
      result.sent.push(summarize(nudge));
    } catch (err) {
      // The DM went out but the record failed: surface loudly so the run can
      // be paused before tomorrow's cron re-sends it.
      console.error("[nudges] sent but failed to record user_nudge", { userId: nudge.userId, err });
      result.failed.push(summarize(nudge));
    }
  }
  return result;
}

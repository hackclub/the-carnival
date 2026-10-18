/**
 * Pure, client-safe helpers for admin outreach (the /admin/messages page and
 * its API). No DB or Slack imports; see outreach-shared.test.mjs.
 */
import { renderNudgeMessage } from "@/lib/insights-shared";

export const OUTREACH_MAX_RECIPIENTS = 1000;
export const OUTREACH_MIN_MESSAGE_LENGTH = 10;
export const OUTREACH_MAX_MESSAGE_LENGTH = 4000;
/** A running send with no heartbeat for this long is shown as interrupted. */
export const OUTREACH_STALE_AFTER_MS = 30 * 60 * 1000;
/** sessionStorage key used to hand a recipient selection to /admin/messages. */
export const OUTREACH_HANDOFF_STORAGE_KEY = "carnival:admin-messages:recipients";

// Slack user IDs: U… or W… followed by uppercase letters/digits.
const SLACK_ID_RE = /^[UW][A-Z0-9]{6,}$/;

export function isSlackUserId(value: string): boolean {
  return SLACK_ID_RE.test(value);
}

export type ParsedSlackIds = {
  ids: string[];
  invalid: string[];
  duplicates: string[];
};

/**
 * Parse a pasted list of Slack IDs: commas, spaces or new lines between
 * entries, and `<@U123>` / `<@U123|name>` mentions or `@U123` are accepted.
 */
export function parseSlackIdList(text: string): ParsedSlackIds {
  const ids: string[] = [];
  const invalid: string[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/[\s,;]+/)) {
    const token = raw.trim();
    if (!token) continue;
    const mention = token.match(/^<@([A-Za-z0-9]+)(?:\|[^>]*)?>$/);
    const candidate = (mention ? mention[1] : token.replace(/^@/, "")).toUpperCase();
    if (!isSlackUserId(candidate)) {
      invalid.push(token);
      continue;
    }
    if (seen.has(candidate)) {
      duplicates.push(candidate);
      continue;
    }
    seen.add(candidate);
    ids.push(candidate);
  }
  return { ids, invalid, duplicates };
}

/** One person in a recipient list being built on the Messages page. */
export type DraftRecipient = {
  userId: string | null;
  slackId: string | null;
  name: string | null;
  email: string | null;
};

function recipientKey(r: DraftRecipient): string {
  return r.userId ? `u:${r.userId}` : `s:${(r.slackId ?? "").toUpperCase()}`;
}

/**
 * Merge recipient lists, de-duplicating by user ID, and by Slack ID for
 * entries without an account. A Slack-ID-only entry is dropped when a user
 * with that Slack ID is already in the list.
 */
export function mergeRecipients(...lists: DraftRecipient[][]): DraftRecipient[] {
  const byKey = new Map<string, DraftRecipient>();
  const userSlackIds = new Set<string>();
  for (const list of lists) {
    for (const r of list) {
      if (!r.userId && !r.slackId) continue;
      const key = recipientKey(r);
      if (byKey.has(key)) continue;
      byKey.set(key, r);
      if (r.userId && r.slackId) userSlackIds.add(r.slackId.toUpperCase());
    }
  }
  return [...byKey.values()].filter(
    (r) => r.userId !== null || !userSlackIds.has((r.slackId ?? "").toUpperCase()),
  );
}

export type OutreachChannel = "slack" | "email";

export type RecipientDecisionInput = {
  channel: OutreachChannel;
  hasSlackId: boolean;
  hasEmail: boolean;
  isFrozen: boolean;
  isExcluded: boolean;
  /** True when skip-recent is on and the person was nudged inside the window. */
  recentlyNudged: boolean;
};

export type RecipientDecision = { status: "pending" } | { status: "skipped"; reason: string };

/** Decide up front whether a recipient will be messaged, and why not. */
export function decideRecipient(input: RecipientDecisionInput): RecipientDecision {
  if (input.isExcluded) return { status: "skipped", reason: "excluded" };
  if (input.isFrozen) return { status: "skipped", reason: "frozen" };
  if (input.recentlyNudged) return { status: "skipped", reason: "recently_nudged" };
  if (input.channel === "slack" && !input.hasSlackId) return { status: "skipped", reason: "no_slack_id" };
  if (input.channel === "email" && !input.hasEmail) return { status: "skipped", reason: "no_email" };
  return { status: "pending" };
}

export const OUTREACH_REASON_LABELS: Record<string, string> = {
  excluded: "on the exclusion list",
  frozen: "account frozen",
  recently_nudged: "nudged in the last 7 days",
  no_slack_id: "no Slack ID",
  no_email: "no email (no Carnival account)",
  slack_error: "Slack rejected the message",
  email_error: "email failed to send",
  interrupted: "send was interrupted",
};

/** Per-person message text ({firstName} replaced). */
export function renderOutreachMessage(template: string, recipient: { name: string | null }): string {
  return renderNudgeMessage(template, { name: recipient.name });
}

/** A running send whose heartbeat is older than the stale window. */
export function isOutreachSendStale(updatedAtIso: string, now: Date): boolean {
  const t = Date.parse(updatedAtIso);
  return Number.isFinite(t) && now.getTime() - t > OUTREACH_STALE_AFTER_MS;
}

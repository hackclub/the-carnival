/**
 * Shared Slack client for every outbound message Carnival sends (creator DMs,
 * the staff review channel, automated nudges).
 *
 * One client, one pacer. chat.postMessage allows roughly one message per
 * second per channel with short bursts; a nudge run or a reviewer fan-out
 * must never burst past that, so every post from this process waits for the
 * next slot (one request start per second). The pacer is per process; a
 * multi-instance deploy would need a shared limiter. @slack/web-api already
 * waits and retries on HTTP 429 on its own.
 */
import { WebClient } from "@slack/web-api";

const token = process.env.SLACK_BOT_TOKEN?.trim();

/** Null when SLACK_BOT_TOKEN is unset: every send becomes a silent no-op. */
export const slack = token ? new WebClient(token) : null;

export function isSlackConfigured(): boolean {
  return Boolean(slack);
}

/** Channel that receives one post per submission plus a thread of follow-ups. */
export function getReviewChannelId(): string | null {
  return process.env.SLACK_REVIEW_CHANNEL_ID?.trim() || null;
}

const SLACK_MIN_REQUEST_INTERVAL_MS = 1000;
let nextSlackRequestAt = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSlackSlot() {
  const now = Date.now();
  const slot = Math.max(now, nextSlackRequestAt);
  nextSlackRequestAt = slot + SLACK_MIN_REQUEST_INTERVAL_MS;
  if (slot > now) await sleep(slot - now);
}

export type SlackPostResult = { ok: true; ts: string | null } | { ok: false; error: string };

/**
 * Post a mrkdwn message to a channel or a user ID (which opens the DM).
 * Never throws: callers treat Slack as best-effort and log on failure.
 */
export async function postSlackMessage(input: {
  channel: string;
  text: string;
  threadTs?: string | null;
}): Promise<SlackPostResult> {
  if (!slack) return { ok: false, error: "slack_not_configured" };
  const channel = input.channel.trim();
  const text = input.text.trim();
  if (!channel || !text) return { ok: false, error: "empty_channel_or_text" };

  await waitForSlackSlot();
  try {
    const response = await slack.chat.postMessage({
      channel,
      text,
      ...(input.threadTs ? { thread_ts: input.threadTs } : {}),
      unfurl_links: false,
      unfurl_media: false,
    });
    return { ok: true, ts: typeof response.ts === "string" ? response.ts : null };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[Slack] postMessage failed", { channel, threadTs: input.threadTs ?? null, error });
    return { ok: false, error };
  }
}

/** Shared request parsing for the /api/admin/messages routes. */
import { getServerSession } from "@/lib/server-session";
import {
  OUTREACH_MAX_MESSAGE_LENGTH,
  OUTREACH_MAX_RECIPIENTS,
  OUTREACH_MIN_MESSAGE_LENGTH,
  parseSlackIdList,
  type OutreachChannel,
} from "./outreach-shared";

export async function requireAdmin(): Promise<{ ok: true; adminId: string } | { ok: false; status: 401 | 403 }> {
  const session = await getServerSession();
  const adminId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!adminId) return { ok: false, status: 401 };
  if (role !== "admin") return { ok: false, status: 403 };
  return { ok: true, adminId };
}

export function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean))];
}

/** Slack IDs from either an array or a pasted string. */
export function parseSlackIdsInput(value: unknown): { ids: string[]; invalid: string[] } {
  const text = Array.isArray(value) ? value.filter((v) => typeof v === "string").join("\n") : typeof value === "string" ? value : "";
  const parsed = parseSlackIdList(text);
  return { ids: parsed.ids, invalid: parsed.invalid };
}

export type RecipientsRequest = {
  channel: OutreachChannel;
  userIds: string[];
  slackIds: string[];
  skipRecentDays: number;
};

export function parseRecipientsRequest(
  body: Record<string, unknown> | null,
): { ok: true; value: RecipientsRequest } | { ok: false; error: string } {
  const channel = body?.channel === "email" ? "email" : body?.channel === "slack" || body?.channel === undefined ? "slack" : null;
  if (!channel) return { ok: false, error: "channel must be slack or email" };
  const userIds = parseStringList(body?.userIds);
  const slack = parseSlackIdsInput(body?.slackIds);
  if (slack.invalid.length) return { ok: false, error: `Not Slack user IDs: ${slack.invalid.slice(0, 5).join(", ")}` };
  if (userIds.length + slack.ids.length === 0) return { ok: false, error: "Add at least one recipient" };
  if (userIds.length + slack.ids.length > OUTREACH_MAX_RECIPIENTS) {
    return { ok: false, error: `Too many recipients (max ${OUTREACH_MAX_RECIPIENTS} per send)` };
  }
  const skip = Number(body?.skipRecentDays);
  return {
    ok: true,
    value: {
      channel,
      userIds,
      slackIds: slack.ids,
      skipRecentDays: Number.isFinite(skip) && skip > 0 ? Math.min(Math.floor(skip), 60) : 0,
    },
  };
}

export function parseMessage(value: unknown): { ok: true; message: string } | { ok: false; error: string } {
  const message = typeof value === "string" ? value.trim() : "";
  if (message.length < OUTREACH_MIN_MESSAGE_LENGTH || message.length > OUTREACH_MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      error: `Message must be between ${OUTREACH_MIN_MESSAGE_LENGTH} and ${OUTREACH_MAX_MESSAGE_LENGTH} characters`,
    };
  }
  return { ok: true, message };
}

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { inArray, max } from "drizzle-orm";
import { db } from "@/db";
import { user, userNudge, type NudgeChannel } from "@/db/schema";
import { appendAdminAudit } from "@/lib/admin-audit";
import {
  isRecentlyNudged,
  isSegmentKey,
  renderNudgeMessage,
  firstNameOf,
} from "@/lib/insights";
import { isNudgeEmailEnabled, sendNudgeEmail } from "@/lib/loops";
import { isSlackNudgeEnabled, sendNudgeDM } from "@/lib/slack";
import { getServerSession } from "@/lib/server-session";

export const maxDuration = 300;

const MAX_RECIPIENTS = 300;
const MIN_MESSAGE_LENGTH = 10;
const MAX_MESSAGE_LENGTH = 4000;
const DEFAULT_SKIP_WITHIN_DAYS = 7;

type NudgePostBody = {
  userIds?: unknown;
  kind?: unknown;
  channel?: unknown;
  message?: unknown;
  skipIfNudgedWithinDays?: unknown;
};

export type NudgeSkipReason = "recently_nudged" | "no_slack_id" | "frozen" | "not_found";

export type NudgeResponse = {
  sent: string[];
  skipped: { userId: string; reason: NudgeSkipReason }[];
  failed: string[];
};

function isNudgeChannel(value: unknown): value is NudgeChannel {
  return value === "slack" || value === "email";
}

export async function POST(req: Request) {
  const session = await getServerSession();
  const currentUserId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: unknown } | undefined)?.role;

  if (!currentUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: NudgePostBody;
  try {
    body = (await req.json()) as NudgePostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isSegmentKey(body.kind)) {
    return NextResponse.json({ error: "Invalid segment kind" }, { status: 400 });
  }
  const kind = body.kind;

  if (!isNudgeChannel(body.channel)) {
    return NextResponse.json({ error: "Invalid channel. Allowed: slack, email" }, { status: 400 });
  }
  const channel = body.channel;

  if (channel === "slack" && !isSlackNudgeEnabled()) {
    return NextResponse.json({ error: "Slack is not configured (SLACK_BOT_TOKEN)" }, { status: 503 });
  }
  if (channel === "email" && !isNudgeEmailEnabled()) {
    return NextResponse.json(
      {
        error:
          "Nudge emails are not configured. Create a Loops transactional template with first_name and message variables, then set LOOPS_TRANSACTIONAL_NUDGE_EMAIL_ID.",
      },
      { status: 503 },
    );
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length < MIN_MESSAGE_LENGTH || message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message must be between ${MIN_MESSAGE_LENGTH} and ${MAX_MESSAGE_LENGTH} characters` },
      { status: 400 },
    );
  }

  const rawIds = Array.isArray(body.userIds) ? body.userIds : [];
  const userIds = [...new Set(rawIds.filter((v): v is string => typeof v === "string" && !!v.trim()))];
  if (userIds.length === 0) {
    return NextResponse.json({ error: "No recipients selected" }, { status: 400 });
  }
  if (userIds.length > MAX_RECIPIENTS) {
    return NextResponse.json(
      { error: `Too many recipients (max ${MAX_RECIPIENTS} per send)` },
      { status: 400 },
    );
  }

  const skipWithinDays =
    typeof body.skipIfNudgedWithinDays === "number" && Number.isFinite(body.skipIfNudgedWithinDays)
      ? Math.max(0, Math.floor(body.skipIfNudgedWithinDays))
      : DEFAULT_SKIP_WITHIN_DAYS;

  const [recipients, lastNudges] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        slackId: user.slackId,
        isFrozen: user.isFrozen,
      })
      .from(user)
      .where(inArray(user.id, userIds)),
    db
      .select({ userId: userNudge.userId, lastAt: max(userNudge.createdAt) })
      .from(userNudge)
      .where(inArray(userNudge.userId, userIds))
      .groupBy(userNudge.userId),
  ]);

  const lastNudgedByUser = new Map(
    lastNudges.map((row) => [row.userId, row.lastAt ? row.lastAt.toISOString() : null]),
  );
  const recipientsById = new Map(recipients.map((r) => [r.id, r]));

  const now = new Date();
  const sent: string[] = [];
  const skipped: NudgeResponse["skipped"] = [];
  const failed: string[] = [];

  for (const userId of userIds) {
    const recipient = recipientsById.get(userId);
    if (!recipient) {
      skipped.push({ userId, reason: "not_found" });
      continue;
    }
    if (recipient.isFrozen) {
      skipped.push({ userId, reason: "frozen" });
      continue;
    }
    if (isRecentlyNudged(lastNudgedByUser.get(userId) ?? null, now, skipWithinDays)) {
      skipped.push({ userId, reason: "recently_nudged" });
      continue;
    }
    if (channel === "slack" && !recipient.slackId) {
      skipped.push({ userId, reason: "no_slack_id" });
      continue;
    }

    const renderedMessage = renderNudgeMessage(message, { name: recipient.name });
    const ok =
      channel === "slack"
        ? await sendNudgeDM(recipient.slackId as string, renderedMessage)
        : await sendNudgeEmail(recipient.email, {
            first_name: firstNameOf(recipient.name),
            message: renderedMessage,
          });

    if (ok) {
      sent.push(userId);
    } else {
      failed.push(userId);
    }
  }

  if (sent.length > 0) {
    const sentAt = new Date();
    await db.insert(userNudge).values(
      sent.map((userId) => ({
        id: randomUUID(),
        userId,
        channel,
        kind,
        message,
        sentByUserId: currentUserId,
        createdAt: sentAt,
      })),
    );
  }

  await appendAdminAudit({
    actorId: currentUserId,
    actorRole: "admin",
    action: "user_nudge_sent",
    details: {
      kind,
      channel,
      requested: userIds.length,
      sent: sent.length,
      skipped: skipped.length,
      failed: failed.length,
      messagePreview: message.slice(0, 200),
    },
  });

  const response: NudgeResponse = { sent, skipped, failed };
  return NextResponse.json(response);
}

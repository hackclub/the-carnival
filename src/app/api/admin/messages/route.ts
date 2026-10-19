import { NextResponse } from "next/server";
import { appendAdminAudit } from "@/lib/admin-audit";
import { createCustomSend, listSends } from "@/lib/notifications/outreach";
import { parseBatchSize, parseMessage, parseRecipientsRequest, requireAdmin } from "@/lib/notifications/outreach-api";
import { isNudgeEmailEnabled } from "@/lib/loops";
import { isSlackConfigured } from "@/lib/notifications/slack-client";

export const dynamic = "force-dynamic";

/** History of admin outreach sends (newest first). */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  return NextResponse.json({ sends: await listSends(30) });
}

/**
 * Create a hand-written send split into batches; batch 1 is delivered in the
 * background now, later batches wait for "send next batch".
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const message = parseMessage(body?.message);
  if (!message.ok) return NextResponse.json({ error: message.error }, { status: 400 });
  const recipients = parseRecipientsRequest(body);
  if (!recipients.ok) return NextResponse.json({ error: recipients.error }, { status: 400 });
  const batch = parseBatchSize(body?.batchSize);
  if (!batch.ok) return NextResponse.json({ error: batch.error }, { status: 400 });

  if (recipients.value.channel === "slack" && !isSlackConfigured()) {
    return NextResponse.json({ error: "Slack is not configured (SLACK_BOT_TOKEN)" }, { status: 503 });
  }
  if (recipients.value.channel === "email" && !isNudgeEmailEnabled()) {
    return NextResponse.json(
      { error: "Email is not configured (LOOPS_TRANSACTIONAL_NUDGE_EMAIL_ID)" },
      { status: 503 },
    );
  }

  const { id, total } = await createCustomSend({
    adminId: auth.adminId,
    message: message.message,
    batchSize: batch.batchSize,
    ...recipients.value,
  });
  await appendAdminAudit({
    actorId: auth.adminId,
    actorRole: "admin",
    action: "outreach_sent",
    details: {
      sendId: id,
      channel: recipients.value.channel,
      recipients: total,
      recentWindow: recipients.value.recentWindow,
      batchSize: batch.batchSize,
      messagePreview: message.message.slice(0, 200),
    },
  });
  return NextResponse.json({ id, total }, { status: 201 });
}

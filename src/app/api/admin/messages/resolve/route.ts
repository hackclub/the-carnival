import { NextResponse } from "next/server";
import { resolveRecipients } from "@/lib/notifications/outreach";
import { parseRecipientsRequest, requireAdmin } from "@/lib/notifications/outreach-api";

export const dynamic = "force-dynamic";

/**
 * Preview who a send would reach, without sending: matches typed Slack IDs
 * to users and marks each person pending or skipped (excluded, frozen, …).
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = parseRecipientsRequest(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const recipients = await resolveRecipients(parsed.value);
  return NextResponse.json({
    recipients: recipients.map((r) => ({
      userId: r.userId,
      slackId: r.slackId,
      name: r.name,
      email: r.email,
      status: r.status,
      reason: r.reason,
    })),
  });
}

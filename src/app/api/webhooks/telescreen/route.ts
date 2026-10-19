/**
 * Robert (Telescreen) outcome webhook. Robert POSTs here when a submission
 * reaches its final outcome: a fraud reviewer scored it 1–4, or Carnival's own
 * decision was recorded. Configure this URL in Robert under the event's
 * Settings → Outcome webhook and put the signing secret in
 * ROBERT_WEBHOOK_SECRET.
 *
 * Retries reuse the delivery id, so handled ids are stored and acknowledged
 * without reprocessing. A failure answers 500 so Robert retries; applying an
 * outcome is idempotent, so a retry after a timeout is harmless.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { telescreenSubmission, telescreenWebhookDelivery } from "@/db/schema";
import type { RobertState } from "@/lib/telescreen/client";
import { telescreenBandForScore } from "@/lib/telescreen/shared";
import { applyRobertProject } from "@/lib/telescreen/submissions";
import { verifyRobertWebhookSignature } from "@/lib/telescreen/webhook-signature";

type OutcomeSetPayload = {
  event: "outcome.set";
  deliveryId: string;
  projectId: string;
  outcome: {
    status: "approved" | "rejected";
    reason: string | null;
    trustScore: number | null;
    reviewedAt: string;
  };
};

export async function POST(req: Request) {
  const secret = process.env.ROBERT_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Telescreen webhook is not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const valid = verifyRobertWebhookSignature({
    secret,
    timestamp: req.headers.get("x-robert-timestamp"),
    signature: req.headers.get("x-robert-signature"),
    rawBody,
  });
  if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  let payload: { event?: unknown; deliveryId?: unknown; projectId?: unknown; outcome?: unknown };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const deliveryId =
    typeof payload.deliveryId === "string" ? payload.deliveryId : req.headers.get("x-robert-delivery");
  if (!deliveryId) return NextResponse.json({ error: "Missing deliveryId" }, { status: 400 });

  const handled = await db
    .select({ deliveryId: telescreenWebhookDelivery.deliveryId })
    .from(telescreenWebhookDelivery)
    .where(eq(telescreenWebhookDelivery.deliveryId, deliveryId))
    .limit(1);
  if (handled[0]) return new NextResponse(null, { status: 204 });

  if (payload.event === "outcome.set") {
    try {
      await handleOutcomeSet(payload as OutcomeSetPayload);
    } catch (err) {
      console.error("[telescreen] webhook outcome.set failed", err);
      return NextResponse.json({ error: "Failed to apply outcome" }, { status: 500 });
    }
  }

  await db
    .insert(telescreenWebhookDelivery)
    .values({
      deliveryId,
      event: typeof payload.event === "string" ? payload.event : "unknown",
      robertProjectId: typeof payload.projectId === "string" ? payload.projectId : null,
      receivedAt: new Date(),
    })
    .onConflictDoNothing();

  return new NextResponse(null, { status: 204 });
}

async function handleOutcomeSet(payload: OutcomeSetPayload) {
  const rows = await db
    .select()
    .from(telescreenSubmission)
    .where(eq(telescreenSubmission.robertProjectId, payload.projectId))
    .limit(1);
  const row = rows[0];
  // Not ours (another platform on the same event) or deleted locally: nothing to do.
  if (!row) return;

  const { outcome } = payload;
  const fraud = outcome.status === "rejected" && telescreenBandForScore(outcome.trustScore) === "fraud";
  const state: RobertState = fraud ? "rejected_fraud" : "decided";
  await applyRobertProject(row, {
    state,
    trustScore: outcome.trustScore,
    // For a fraud rejection the reason *is* the reviewer's note.
    review:
      fraud && outcome.trustScore !== null
        ? { trustScore: outcome.trustScore, note: outcome.reason, at: outcome.reviewedAt }
        : null,
    outcome: { status: outcome.status, reason: outcome.reason, at: outcome.reviewedAt },
    creditedSeconds: null,
  });
}

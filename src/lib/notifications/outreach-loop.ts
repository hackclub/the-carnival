/**
 * The delivery loop for an admin outreach send, with storage injected so it
 * can be tested (outreach-loop.test.mjs). It only ever picks recipients still
 * marked "pending" and records each result before moving on, which is what
 * makes Resume safe: nobody already sent or failed is touched again.
 */

export type LoopRecipient = {
  id: string;
  userId: string | null;
  name: string | null;
  slackId: string | null;
  email: string | null;
};

export type DeliveryResult = { ok: true } | { ok: false; reason: string };

export type OutreachLoopDeps = {
  nextPending: () => Promise<LoopRecipient | null>;
  deliver: (recipient: LoopRecipient) => Promise<DeliveryResult>;
  markSent: (recipient: LoopRecipient) => Promise<void>;
  markFailed: (recipient: LoopRecipient, reason: string) => Promise<void>;
  /** Called after every recipient so a dead process can be detected. */
  heartbeat: () => Promise<void>;
};

export async function runOutreachLoop(deps: OutreachLoopDeps): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  // Bounded by the number of pending rows; the guard stops a storage bug that
  // never clears a row from looping forever.
  const seen = new Set<string>();
  for (;;) {
    const recipient = await deps.nextPending();
    if (!recipient) break;
    if (seen.has(recipient.id)) {
      throw new Error(`Recipient ${recipient.id} is still pending after being processed`);
    }
    seen.add(recipient.id);

    const result = await deps.deliver(recipient);
    if (result.ok) {
      await deps.markSent(recipient);
      sent += 1;
    } else {
      await deps.markFailed(recipient, result.reason);
      failed += 1;
    }
    await deps.heartbeat();
  }
  return { sent, failed };
}

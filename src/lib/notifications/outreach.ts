/**
 * Admin outreach (DB half): the exclusion list, hand-written sends, manual
 * "run now" of the automated nudges, history, and resume.
 *
 * Sending happens in the background inside the app container (see
 * runAfterResponse): POST returns as soon as the send and its recipient rows
 * exist, then runOutreachLoop delivers at 1 msg/s (the Slack client's pacer)
 * and records each result immediately.
 */
import { randomUUID } from "crypto";
import { and, asc, desc, eq, gt, inArray, lt, lte, max, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  nudgeExclusion,
  outreachRecipient,
  outreachSend,
  user,
  userNudge,
  type OutreachRecipientStatus,
  type OutreachSendKind,
  type OutreachSendStatus,
} from "@/db/schema";
import { firstNameOf } from "@/lib/insights";
import { isNudgeEmailEnabled, sendNudgeEmail } from "@/lib/loops";
import { runAfterResponse } from "./after-response";
import { summarizeNudgeRun } from "./nudges/command";
import { NUDGE_KIND_META } from "./nudges/kinds";
import { createNudgeLock } from "./nudges/lock";
import { runNudges } from "./nudges/run";
import { runOutreachLoop, type LoopRecipient } from "./outreach-loop";
import {
  OUTREACH_STALE_AFTER_MS,
  assignBatches,
  decideRecipient,
  isNudgedWithin,
  isRecentWindow,
  mergeRecipients,
  recentWindowCutoff,
  renderOutreachMessage,
  type DraftRecipient,
  type OutreachChannel,
  type RecentWindow,
} from "./outreach-shared";
import { isSlackConfigured, postSlackMessage } from "./slack-client";

const INSERT_CHUNK = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function upperIds(ids: readonly (string | null | undefined)[]): string[] {
  return [...new Set(ids.map((s) => s?.trim().toUpperCase()).filter((s): s is string => Boolean(s)))];
}

// ---------------------------------------------------------------------------
// Exclusion list
// ---------------------------------------------------------------------------

export type ExclusionRow = {
  slackId: string;
  note: string | null;
  createdAtIso: string;
  addedByName: string | null;
  userId: string | null;
  userName: string | null;
};

export type SelfOptOutRow = { userId: string; name: string; slackId: string | null; email: string };

export async function listExclusions(): Promise<{ excluded: ExclusionRow[]; selfOptedOut: SelfOptOutRow[] }> {
  const rows = await db
    .select({
      slackId: nudgeExclusion.slackId,
      note: nudgeExclusion.note,
      createdAt: nudgeExclusion.createdAt,
      addedByName: user.name,
    })
    .from(nudgeExclusion)
    .leftJoin(user, eq(user.id, nudgeExclusion.addedByUserId))
    .orderBy(desc(nudgeExclusion.createdAt));

  const matches = rows.length
    ? await db
        .select({ id: user.id, name: user.name, slackId: user.slackId })
        .from(user)
        .where(inArray(sql`upper(${user.slackId})`, rows.map((r) => r.slackId)))
    : [];
  const bySlack = new Map(matches.map((m) => [(m.slackId ?? "").toUpperCase(), m]));

  const selfOptedOut = await db
    .select({ userId: user.id, name: user.name, slackId: user.slackId, email: user.email })
    .from(user)
    .where(eq(user.slackNudgesOptOut, true))
    .orderBy(asc(user.name));

  return {
    excluded: rows.map((r) => {
      const match = bySlack.get(r.slackId);
      return {
        slackId: r.slackId,
        note: r.note,
        createdAtIso: r.createdAt.toISOString(),
        addedByName: r.addedByName,
        userId: match?.id ?? null,
        userName: match?.name ?? null,
      };
    }),
    selfOptedOut,
  };
}

export async function addExclusions(input: { slackIds: string[]; note: string | null; adminId: string }) {
  const ids = upperIds(input.slackIds);
  if (ids.length === 0) return { added: [] as string[], alreadyExcluded: [] as string[] };
  const inserted = await db
    .insert(nudgeExclusion)
    .values(ids.map((slackId) => ({ slackId, note: input.note, addedByUserId: input.adminId, createdAt: new Date() })))
    .onConflictDoNothing()
    .returning({ slackId: nudgeExclusion.slackId });
  const added = inserted.map((r) => r.slackId);
  return { added, alreadyExcluded: ids.filter((id) => !added.includes(id)) };
}

export async function removeExclusion(slackId: string): Promise<boolean> {
  const removed = await db
    .delete(nudgeExclusion)
    .where(eq(nudgeExclusion.slackId, slackId.trim().toUpperCase()))
    .returning({ slackId: nudgeExclusion.slackId });
  return removed.length > 0;
}

async function loadExcludedSet(slackIds: readonly (string | null)[]): Promise<Set<string>> {
  const ids = upperIds(slackIds);
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ slackId: nudgeExclusion.slackId })
    .from(nudgeExclusion)
    .where(inArray(nudgeExclusion.slackId, ids));
  return new Set(rows.map((r) => r.slackId.toUpperCase()));
}

// ---------------------------------------------------------------------------
// Hand-written sends
// ---------------------------------------------------------------------------

export type CreateCustomSendInput = {
  adminId: string;
  message: string;
  channel: OutreachChannel;
  userIds: string[];
  /** Slack IDs typed in; matched to users where possible. */
  slackIds: string[];
  recentWindow: RecentWindow;
  /** People per batch; batch 1 goes out now, later ones on "send next batch". */
  batchSize: number;
};

export type ResolvedRecipient = DraftRecipient & {
  isFrozen: boolean;
  status: OutreachRecipientStatus;
  reason: string | null;
};

/**
 * Decide who among these people will be messaged: excluded, frozen, nudged
 * inside the recent window, or missing the channel's contact are skipped.
 * Used when a send is created and again before each later batch goes out.
 */
async function decideAll(
  drafts: DraftRecipient[],
  channel: OutreachChannel,
  recentWindow: RecentWindow,
  now = new Date(),
): Promise<ResolvedRecipient[]> {
  const userIds = [...new Set(drafts.map((r) => r.userId).filter((v): v is string => Boolean(v)))];
  const cutoff = recentWindowCutoff(recentWindow, now);

  const frozen = new Map<string, boolean>();
  const lastNudged = new Map<string, string | null>();
  for (const part of chunk(userIds, INSERT_CHUNK)) {
    const [frozenRows, nudgeRows] = await Promise.all([
      db.select({ id: user.id, isFrozen: user.isFrozen }).from(user).where(inArray(user.id, part)),
      cutoff
        ? db
            .select({ userId: userNudge.userId, lastAt: max(userNudge.createdAt) })
            .from(userNudge)
            .where(inArray(userNudge.userId, part))
            .groupBy(userNudge.userId)
        : Promise.resolve([]),
    ]);
    for (const r of frozenRows) frozen.set(r.id, r.isFrozen);
    for (const r of nudgeRows) lastNudged.set(r.userId, r.lastAt ? r.lastAt.toISOString() : null);
  }
  const excluded = await loadExcludedSet(drafts.map((r) => r.slackId));

  return drafts.map((r): ResolvedRecipient => {
    const isFrozen = r.userId ? (frozen.get(r.userId) ?? false) : false;
    const decision = decideRecipient({
      channel,
      hasSlackId: Boolean(r.slackId),
      hasEmail: Boolean(r.email),
      isFrozen,
      isExcluded: r.slackId ? excluded.has(r.slackId.toUpperCase()) : false,
      recentlyNudged: r.userId ? isNudgedWithin(lastNudged.get(r.userId) ?? null, cutoff) : false,
    });
    return {
      ...r,
      isFrozen,
      status: decision.status,
      reason: decision.status === "skipped" ? decision.reason : null,
    };
  });
}

/**
 * Resolve the final recipient list: users by ID, typed Slack IDs matched to
 * users (unmatched ones kept as Slack-only), de-duplicated, then each one
 * decided up front (excluded / frozen / recently nudged / no contact).
 */
export async function resolveRecipients(
  input: Pick<CreateCustomSendInput, "channel" | "userIds" | "slackIds" | "recentWindow">,
) {
  const userIds = [...new Set(input.userIds.map((s) => s.trim()).filter(Boolean))];
  const slackIds = upperIds(input.slackIds);

  const userColumns = {
    id: user.id,
    name: user.name,
    email: user.email,
    slackId: user.slackId,
  };
  const [byId, bySlack] = await Promise.all([
    userIds.length
      ? Promise.all(chunk(userIds, INSERT_CHUNK).map((part) => db.select(userColumns).from(user).where(inArray(user.id, part)))).then(
          (parts) => parts.flat(),
        )
      : Promise.resolve([]),
    slackIds.length
      ? db.select(userColumns).from(user).where(inArray(sql`upper(${user.slackId})`, slackIds))
      : Promise.resolve([]),
  ]);

  // Keep the order the admin built the list in.
  const order = new Map(userIds.map((id, i) => [id, i]));
  byId.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  const toDraft = (u: (typeof byId)[number]): DraftRecipient => ({
    userId: u.id,
    slackId: u.slackId?.trim().toUpperCase() || null,
    name: u.name,
    email: u.email,
  });
  const matchedSlack = new Set(bySlack.map((u) => (u.slackId ?? "").toUpperCase()));
  const slackOnly: DraftRecipient[] = slackIds
    .filter((id) => !matchedSlack.has(id))
    .map((id) => ({ userId: null, slackId: id, name: null, email: null }));

  const merged = mergeRecipients(byId.map(toDraft), bySlack.map(toDraft), slackOnly);
  return decideAll(merged, input.channel, input.recentWindow);
}

/** Create the send and its recipient rows, then deliver in the background. */
export async function createCustomSend(input: CreateCustomSendInput): Promise<{ id: string; total: number }> {
  const recipients = await resolveRecipients(input);
  const id = randomUUID();
  const now = new Date();
  const skipped = recipients.filter((r) => r.status === "skipped").length;
  const batches = assignBatches(
    recipients.map((r) => (r.status === "skipped" ? "skipped" : "pending")),
    input.batchSize,
  );

  await db.transaction(async (tx) => {
    await tx.insert(outreachSend).values({
      id,
      kind: "custom",
      channel: input.channel,
      message: input.message,
      createdByUserId: input.adminId,
      status: "running",
      total: recipients.length,
      skipped,
      batchSize: input.batchSize,
      currentBatch: 1,
      recentWindow: input.recentWindow,
      createdAt: now,
      updatedAt: now,
    });
    const rows = recipients.map((r, i) => ({ r, batch: batches[i] ?? 1, i }));
    for (const part of chunk(rows, INSERT_CHUNK)) {
      await tx.insert(outreachRecipient).values(
        part.map(({ r, batch, i }) => ({
          id: randomUUID(),
          sendId: id,
          userId: r.userId,
          name: r.name,
          slackId: r.slackId,
          email: r.email,
          status: r.status,
          batch,
          reason: r.reason,
          // Delivery follows createdAt order, so keep the list order within a batch.
          createdAt: new Date(now.getTime() + i),
        })),
      );
    }
  });

  runAfterResponse(() => processCustomSend(id), `outreach send ${id}`);
  return { id, total: recipients.length };
}

async function processCustomSend(sendId: string): Promise<void> {
  const sendRows = await db
    .select({
      message: outreachSend.message,
      channel: outreachSend.channel,
      adminId: outreachSend.createdByUserId,
      currentBatch: outreachSend.currentBatch,
    })
    .from(outreachSend)
    .where(eq(outreachSend.id, sendId))
    .limit(1);
  const send = sendRows[0];
  if (!send?.message) return;
  const template = send.message;

  try {
    await runOutreachLoop({
      async nextPending() {
        const rows = await db
          .select({
            id: outreachRecipient.id,
            userId: outreachRecipient.userId,
            name: outreachRecipient.name,
            slackId: outreachRecipient.slackId,
            email: outreachRecipient.email,
          })
          .from(outreachRecipient)
          .where(
            and(
              eq(outreachRecipient.sendId, sendId),
              eq(outreachRecipient.status, "pending"),
              lte(outreachRecipient.batch, send.currentBatch),
            ),
          )
          .orderBy(asc(outreachRecipient.createdAt), asc(outreachRecipient.id))
          .limit(1);
        return rows[0] ?? null;
      },
      async deliver(r: LoopRecipient) {
        const text = renderOutreachMessage(template, r);
        if (send.channel === "email") {
          if (!r.email || !isNudgeEmailEnabled()) return { ok: false, reason: "email_error" };
          const ok = await sendNudgeEmail(r.email, { first_name: firstNameOf(r.name), message: text });
          return ok ? { ok: true } : { ok: false, reason: "email_error" };
        }
        if (!r.slackId || !isSlackConfigured()) return { ok: false, reason: "slack_error" };
        const result = await postSlackMessage({ channel: r.slackId, text });
        return result.ok ? { ok: true } : { ok: false, reason: "slack_error" };
      },
      async markSent(r) {
        const now = new Date();
        await db
          .update(outreachRecipient)
          .set({ status: "sent", sentAt: now, reason: null })
          .where(eq(outreachRecipient.id, r.id));
        // The automated nudges' quiet window counts hand-written messages too.
        if (r.userId) {
          await db.insert(userNudge).values({
            id: randomUUID(),
            userId: r.userId,
            channel: send.channel,
            kind: "custom",
            message: renderOutreachMessage(template, r),
            sentByUserId: send.adminId,
            createdAt: now,
          });
        }
      },
      async markFailed(r, reason) {
        await db.update(outreachRecipient).set({ status: "failed", reason }).where(eq(outreachRecipient.id, r.id));
      },
      async heartbeat() {
        await db.update(outreachSend).set({ updatedAt: new Date() }).where(eq(outreachSend.id, sendId));
      },
    });
    await finishBatch(sendId, send.currentBatch);
  } catch (err) {
    console.error("[outreach] send failed", { sendId, err });
    await db
      .update(outreachRecipient)
      .set({ status: "skipped", reason: "interrupted" })
      .where(and(eq(outreachRecipient.sendId, sendId), eq(outreachRecipient.status, "pending")))
      .catch(() => undefined);
    await finishSend(sendId, "failed", { error: err instanceof Error ? err.message : String(err) });
  }
}

async function recountSend(sendId: string) {
  const rows = await db
    .select({ status: outreachRecipient.status, n: sql<number>`count(*)::int` })
    .from(outreachRecipient)
    .where(eq(outreachRecipient.sendId, sendId))
    .groupBy(outreachRecipient.status);
  const counts = { total: 0, sent: 0, skipped: 0, failed: 0, pending: 0 };
  for (const r of rows) {
    counts.total += r.n;
    counts[r.status] += r.n;
  }
  return counts;
}

/** After a batch drains: wait for the admin if later batches are queued, else complete. */
async function finishBatch(sendId: string, currentBatch: number) {
  const queued = await db
    .select({ id: outreachRecipient.id })
    .from(outreachRecipient)
    .where(
      and(
        eq(outreachRecipient.sendId, sendId),
        eq(outreachRecipient.status, "pending"),
        gt(outreachRecipient.batch, currentBatch),
      ),
    )
    .limit(1);
  if (queued.length === 0) {
    await finishSend(sendId, "completed");
    return;
  }
  const counts = await recountSend(sendId);
  await db
    .update(outreachSend)
    .set({
      status: "waiting",
      total: counts.total,
      sent: counts.sent,
      skipped: counts.skipped,
      failed: counts.failed,
      updatedAt: new Date(),
    })
    .where(eq(outreachSend.id, sendId));
}

async function finishSend(sendId: string, status: OutreachSendStatus, extra: Record<string, unknown> = {}) {
  const counts = await recountSend(sendId);
  const now = new Date();
  await db
    .update(outreachSend)
    .set({
      status,
      total: counts.total,
      sent: counts.sent,
      skipped: counts.skipped,
      failed: counts.failed,
      ...(Object.keys(extra).length ? { summary: extra } : {}),
      updatedAt: now,
      finishedAt: now,
    })
    .where(eq(outreachSend.id, sendId));
}

/**
 * Restart delivery for an interrupted hand-written send. The status flip is
 * atomic, so two clicks can't start two loops; only pending rows are sent.
 */
export async function resumeSend(sendId: string): Promise<"resumed" | "not_interrupted" | "not_custom"> {
  await markStaleSends();
  const rows = await db
    .update(outreachSend)
    .set({ status: "running", updatedAt: new Date(), finishedAt: null })
    .where(and(eq(outreachSend.id, sendId), eq(outreachSend.status, "interrupted"), eq(outreachSend.kind, "custom")))
    .returning({ id: outreachSend.id });
  if (!rows[0]) {
    const kind = await db.select({ kind: outreachSend.kind }).from(outreachSend).where(eq(outreachSend.id, sendId)).limit(1);
    return kind[0]?.kind === "automated" ? "not_custom" : "not_interrupted";
  }
  runAfterResponse(() => processCustomSend(sendId), `outreach resume ${sendId}`);
  return "resumed";
}

export type NextBatchOutcome =
  | { ok: true; batch: number; pending: number; skipped: number }
  | { ok: false; reason: "not_waiting" };

/**
 * Release the next batch of a waiting send. The status flip is atomic, so two
 * clicks can't release two batches. Each person in the batch is checked again
 * (exclusion list, frozen, nudged inside the send's recent window) since they
 * were picked, possibly days ago.
 */
export async function releaseNextBatch(sendId: string): Promise<NextBatchOutcome> {
  const flipped = await db
    .update(outreachSend)
    .set({ status: "running", currentBatch: sql`${outreachSend.currentBatch} + 1`, updatedAt: new Date() })
    .where(and(eq(outreachSend.id, sendId), eq(outreachSend.status, "waiting"), eq(outreachSend.kind, "custom")))
    .returning({ currentBatch: outreachSend.currentBatch, channel: outreachSend.channel, recentWindow: outreachSend.recentWindow });
  const send = flipped[0];
  if (!send) return { ok: false, reason: "not_waiting" };

  const rows = await db
    .select({
      id: outreachRecipient.id,
      userId: outreachRecipient.userId,
      name: outreachRecipient.name,
      slackId: outreachRecipient.slackId,
      email: outreachRecipient.email,
    })
    .from(outreachRecipient)
    .where(
      and(
        eq(outreachRecipient.sendId, sendId),
        eq(outreachRecipient.status, "pending"),
        eq(outreachRecipient.batch, send.currentBatch),
      ),
    );
  const window = isRecentWindow(send.recentWindow) ? send.recentWindow : "off";
  const decided = await decideAll(rows, send.channel, window);
  const skippedNow = decided
    .map((d, i) => ({ d, row: rows[i] }))
    .filter((x): x is { d: ResolvedRecipient; row: (typeof rows)[number] } => x.d.status === "skipped" && Boolean(x.row));
  for (const { d, row } of skippedNow) {
    await db.update(outreachRecipient).set({ status: "skipped", reason: d.reason }).where(eq(outreachRecipient.id, row.id));
  }

  runAfterResponse(() => processCustomSend(sendId), `outreach batch ${send.currentBatch} ${sendId}`);
  return { ok: true, batch: send.currentBatch, pending: rows.length - skippedNow.length, skipped: skippedNow.length };
}

/** Drop the batches still queued on a waiting send; their people are marked skipped. */
export async function cancelRemainingBatches(sendId: string): Promise<boolean> {
  const flipped = await db
    .update(outreachSend)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(outreachSend.id, sendId), eq(outreachSend.status, "waiting")))
    .returning({ id: outreachSend.id });
  if (!flipped[0]) return false;
  await db
    .update(outreachRecipient)
    .set({ status: "skipped", reason: "cancelled" })
    .where(and(eq(outreachRecipient.sendId, sendId), eq(outreachRecipient.status, "pending")));
  await finishSend(sendId, "cancelled");
  return true;
}

/** Running sends whose process stopped heartbeating become "interrupted". */
export async function markStaleSends(now = new Date()): Promise<void> {
  await db
    .update(outreachSend)
    .set({ status: "interrupted" })
    .where(
      and(
        eq(outreachSend.status, "running"),
        lt(outreachSend.updatedAt, new Date(now.getTime() - OUTREACH_STALE_AFTER_MS)),
      ),
    );
}

// ---------------------------------------------------------------------------
// Manual "run now" of the automated nudges
// ---------------------------------------------------------------------------

export async function startAutomatedRun(input: {
  adminId: string;
  maxSends?: number;
  allowlist?: string[];
}): Promise<{ id: string }> {
  const id = randomUUID();
  const now = new Date();
  await db.insert(outreachSend).values({
    id,
    kind: "automated",
    channel: "slack",
    message: null,
    createdByUserId: input.adminId,
    status: "running",
    summary: { requestedMaxSends: input.maxSends ?? null, allowlist: input.allowlist ?? null },
    createdAt: now,
    updatedAt: now,
  });

  runAfterResponse(async () => {
    const lock = createNudgeLock();
    let locked = false;
    try {
      locked = await lock.tryLock();
      if (!locked) {
        await finishSend(id, "failed", { error: "Another nudge run (scheduled or manual) is already in progress." });
        return;
      }
      // Heartbeat while the run works so it isn't marked interrupted.
      const beat = setInterval(() => {
        void db.update(outreachSend).set({ updatedAt: new Date() }).where(eq(outreachSend.id, id));
      }, 60_000);
      let result;
      try {
        result = await runNudges({ dryRun: false, maxSends: input.maxSends, allowlist: input.allowlist });
      } finally {
        clearInterval(beat);
      }
      const recipientRows = [
        ...result.sent.map((p) => ({ p, status: "sent" as const, reason: null })),
        ...result.failed.map((p) => ({ p, status: "failed" as const, reason: "slack_error" })),
      ];
      for (const part of chunk(recipientRows, INSERT_CHUNK)) {
        await db.insert(outreachRecipient).values(
          part.map(({ p, status, reason }) => ({
            id: randomUUID(),
            sendId: id,
            userId: p.userId,
            name: p.name,
            slackId: p.slackId,
            email: null,
            status,
            // For sent rows, show which reminder went out ("Never connected Hackatime").
            reason: reason ?? `${NUDGE_KIND_META[p.kind].label}${p.sendNumber > 1 ? " (last call)" : ""}`,
            sentAt: status === "sent" ? new Date() : null,
            createdAt: new Date(),
          })),
        );
      }
      await finishSend(id, result.recordFailed ? "failed" : "completed", summarizeNudgeRun(result));
    } catch (err) {
      console.error("[outreach] automated run failed", { id, err });
      await finishSend(id, "failed", { error: err instanceof Error ? err.message : String(err) });
    } finally {
      if (locked) await lock.unlock().catch(() => undefined);
      await lock.close();
    }
  }, `automated nudge run ${id}`);

  return { id };
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export type OutreachSendSummary = {
  id: string;
  kind: OutreachSendKind;
  channel: string;
  status: OutreachSendStatus;
  messagePreview: string | null;
  createdByName: string | null;
  createdAtIso: string;
  finishedAtIso: string | null;
  /** pending = in batches already released; queued = in later batches still waiting. */
  counts: { total: number; sent: number; skipped: number; failed: number; pending: number; queued: number };
  batches: { size: number | null; current: number; total: number; nextBatchSize: number };
  recentWindow: string;
  summary: Record<string, unknown>;
};

export async function listSends(limit = 30, onlyIds?: string[]): Promise<OutreachSendSummary[]> {
  await markStaleSends();
  const rows = await db
    .select({
      id: outreachSend.id,
      kind: outreachSend.kind,
      channel: outreachSend.channel,
      status: outreachSend.status,
      message: outreachSend.message,
      createdByName: user.name,
      createdAt: outreachSend.createdAt,
      finishedAt: outreachSend.finishedAt,
      batchSize: outreachSend.batchSize,
      currentBatch: outreachSend.currentBatch,
      recentWindow: outreachSend.recentWindow,
      summary: outreachSend.summary,
    })
    .from(outreachSend)
    .leftJoin(user, eq(user.id, outreachSend.createdByUserId))
    .where(onlyIds ? inArray(outreachSend.id, onlyIds) : undefined)
    .orderBy(desc(outreachSend.createdAt))
    .limit(limit);

  const ids = rows.map((r) => r.id);
  const countRows = ids.length
    ? await db
        .select({
          sendId: outreachRecipient.sendId,
          status: outreachRecipient.status,
          batch: outreachRecipient.batch,
          n: sql<number>`count(*)::int`,
        })
        .from(outreachRecipient)
        .where(inArray(outreachRecipient.sendId, ids))
        .groupBy(outreachRecipient.sendId, outreachRecipient.status, outreachRecipient.batch)
    : [];
  const currentBatchById = new Map(rows.map((r) => [r.id, r.currentBatch]));
  const emptyCounts = () => ({ total: 0, sent: 0, skipped: 0, failed: 0, pending: 0, queued: 0 });
  const counts = new Map<string, OutreachSendSummary["counts"]>();
  const batchInfo = new Map<string, { total: number; next: number }>();
  for (const r of countRows) {
    const c = counts.get(r.sendId) ?? emptyCounts();
    const current = currentBatchById.get(r.sendId) ?? 1;
    const b = batchInfo.get(r.sendId) ?? { total: 0, next: 0 };
    c.total += r.n;
    if (r.status === "pending" && r.batch > current) c.queued += r.n;
    else c[r.status] += r.n;
    if (r.status !== "skipped") b.total = Math.max(b.total, r.batch);
    if (r.status === "pending" && r.batch === current + 1) b.next += r.n;
    counts.set(r.sendId, c);
    batchInfo.set(r.sendId, b);
  }

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    channel: r.channel,
    status: r.status,
    messagePreview: r.message ? r.message.slice(0, 160) : null,
    createdByName: r.createdByName,
    createdAtIso: r.createdAt.toISOString(),
    finishedAtIso: r.finishedAt ? r.finishedAt.toISOString() : null,
    counts: counts.get(r.id) ?? emptyCounts(),
    batches: {
      size: r.batchSize,
      current: r.currentBatch,
      total: batchInfo.get(r.id)?.total ?? 0,
      nextBatchSize: batchInfo.get(r.id)?.next ?? 0,
    },
    recentWindow: r.recentWindow,
    summary: r.summary,
  }));
}

export type OutreachRecipientRow = {
  id: string;
  userId: string | null;
  name: string | null;
  slackId: string | null;
  email: string | null;
  status: OutreachRecipientStatus;
  batch: number;
  reason: string | null;
  sentAtIso: string | null;
};

export async function getSendDetail(sendId: string) {
  const sends = await listSends(1, [sendId]);
  const send = sends[0];
  if (!send) return null;
  const recipients = await db
    .select({
      id: outreachRecipient.id,
      userId: outreachRecipient.userId,
      name: outreachRecipient.name,
      slackId: outreachRecipient.slackId,
      email: outreachRecipient.email,
      status: outreachRecipient.status,
      batch: outreachRecipient.batch,
      reason: outreachRecipient.reason,
      sentAt: outreachRecipient.sentAt,
    })
    .from(outreachRecipient)
    .where(eq(outreachRecipient.sendId, sendId))
    .orderBy(asc(outreachRecipient.batch), asc(outreachRecipient.createdAt), asc(outreachRecipient.id));
  const full = await db.select({ message: outreachSend.message }).from(outreachSend).where(eq(outreachSend.id, sendId)).limit(1);
  return {
    send: { ...send, message: full[0]?.message ?? null },
    recipients: recipients.map(
      (r): OutreachRecipientRow => ({
        id: r.id,
        userId: r.userId,
        name: r.name,
        slackId: r.slackId,
        email: r.email,
        status: r.status,
        batch: r.batch,
        reason: r.reason,
        sentAtIso: r.sentAt ? r.sentAt.toISOString() : null,
      }),
    ),
  };
}

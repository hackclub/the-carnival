/**
 * Telescreen (Robert) fraud review — the Carnival side.
 *
 * Lifecycle of one row in telescreen_submission:
 *
 *   creator submits (WIP → in-review)
 *     → createTelescreenSubmission: row in "pending"
 *     → sendTelescreenSubmission:   POST to Robert → "awaiting_review"
 *   fraud reviewer scores it in Telescreen
 *     1–4  → Robert sends outcome.set (rejected) → applyRobertProject
 *            → applyFraudRejection: project rejected + dismissed
 *     5–10 → "awaiting_outcome"; no webhook, so syncTelescreen / a staff page
 *            load reads the score back with GET
 *   Carnival decides (grant → approved, dismissal → rejected)
 *     → setCarnivalOutcome → recordRobertOutcome → "decided"
 *
 * The project's *current* submission is its latest row. Admin re-queues and the
 * "Hackatime dropped below approved hours" return keep the same row; only a
 * creator submission from work-in-progress starts a new one.
 *
 * Every function here is best-effort: Robert errors are stored on the row
 * (lastError) and retried by the sync, never thrown at the request that
 * triggered them.
 */
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  project,
  projectReviewerAssignment,
  telescreenSubmission,
  user,
  type TelescreenOutcomeStatus,
  type TelescreenState,
} from "@/db/schema";
import { generateId } from "@/lib/api-utils";
import { deleteAirtableGrantRecord } from "@/lib/airtable";
import { listProjectHackatimeProjects } from "@/lib/devlogs";
import { getAppBaseUrl, sendReviewEmail } from "@/lib/loops";
import { notifyReviewDM, notifyStaffReviewThread } from "@/lib/notifications/review-events";
import {
  RobertApiError,
  deleteRobertProject,
  getRobertProject,
  isTelescreenEnabled,
  recordRobertOutcome,
  submitRobertProject,
  type RobertProject,
} from "./client";
import {
  TELESCREEN_FRAUD_CREATOR_MESSAGE,
  evaluateTelescreenGrantGate,
  telescreenBandForScore,
  type TelescreenGate,
  type TelescreenSubmissionView,
} from "./shared";

export type TelescreenSubmissionRow = typeof telescreenSubmission.$inferSelect;

// Robert caps hackatimeProjects at 50 names per submission.
const MAX_HACKATIME_PROJECTS = 50;

export function telescreenExternalId(projectId: string, submittedAt: Date): string {
  return `carnival:${projectId}:${submittedAt.getTime()}`;
}

export function toTelescreenView(row: TelescreenSubmissionRow): TelescreenSubmissionView {
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return {
    id: row.id,
    externalId: row.externalId,
    robertProjectId: row.robertProjectId,
    state: row.state,
    trustScore: row.trustScore,
    band: telescreenBandForScore(row.trustScore),
    reviewNote: row.reviewNote,
    reviewedAt: iso(row.reviewedAt),
    creditedSeconds: row.creditedSeconds,
    outcomeStatus: row.outcomeStatus,
    outcomeReason: row.outcomeReason,
    carnivalOutcome: row.carnivalOutcome,
    carnivalOutcomeSentAt: iso(row.carnivalOutcomeSentAt),
    sentAt: iso(row.sentAt),
    lastSyncedAt: iso(row.lastSyncedAt),
    lastError: row.lastError,
    lastErrorAt: iso(row.lastErrorAt),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getCurrentTelescreenSubmission(
  projectId: string,
): Promise<TelescreenSubmissionRow | null> {
  const rows = await db
    .select()
    .from(telescreenSubmission)
    .where(eq(telescreenSubmission.projectId, projectId))
    .orderBy(desc(telescreenSubmission.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

async function updateRow(
  id: string,
  set: Partial<typeof telescreenSubmission.$inferInsert>,
): Promise<TelescreenSubmissionRow | null> {
  const rows = await db
    .update(telescreenSubmission)
    .set({ ...set, updatedAt: new Date() })
    .where(eq(telescreenSubmission.id, id))
    .returning();
  return rows[0] ?? null;
}

async function recordError(row: TelescreenSubmissionRow, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.warn(`[telescreen] ${row.externalId}: ${message}`);
  await updateRow(row.id, { lastError: message.slice(0, 1000), lastErrorAt: new Date() }).catch(
    (dbErr) => console.error("[telescreen] failed to record error", dbErr),
  );
}

/** Start a new Telescreen entry for a creator submission. Idempotent per (project, submittedAt). */
export async function createTelescreenSubmission(
  projectId: string,
  submittedAt: Date,
): Promise<TelescreenSubmissionRow | null> {
  const now = new Date();
  const externalId = telescreenExternalId(projectId, submittedAt);
  await db
    .insert(telescreenSubmission)
    .values({ id: generateId(), projectId, externalId, state: "pending", createdAt: now, updatedAt: now })
    .onConflictDoNothing({ target: telescreenSubmission.externalId });
  const rows = await db
    .select()
    .from(telescreenSubmission)
    .where(eq(telescreenSubmission.externalId, externalId))
    .limit(1);
  return rows[0] ?? null;
}

async function buildSubmitPayload(projectId: string, externalId: string) {
  const rows = await db
    .select({
      name: project.name,
      codeUrl: project.codeUrl,
      playableDemoUrl: project.playableDemoUrl,
      videoUrl: project.videoUrl,
      hackatimeProjectName: project.hackatimeProjectName,
      slackId: user.slackId,
      hackatimeUserId: user.hackatimeUserId,
    })
    .from(project)
    .leftJoin(user, eq(project.creatorId, user.id))
    .where(eq(project.id, projectId))
    .limit(1);
  const p = rows[0];
  if (!p) throw new Error("Project not found");

  const linked = await listProjectHackatimeProjects(projectId);
  const names = [...new Set([p.hackatimeProjectName, ...linked.map((l) => l.name)].map((n) => n.trim()))]
    .filter(Boolean)
    .slice(0, MAX_HACKATIME_PROJECTS);
  if (names.length === 0) throw new Error("Project has no Hackatime project names");

  // Robert identifies people by Slack ID (exactly as Slack writes it) and/or
  // numeric Hackatime ID; sending the Hackatime ID guarantees hours get credited.
  const slackId = p.slackId?.trim().toUpperCase() || undefined;
  const hackatimeRaw = p.hackatimeUserId?.trim() ?? "";
  const hackatimeId = /^\d+$/.test(hackatimeRaw) ? Number(hackatimeRaw) : undefined;
  if (!slackId && hackatimeId === undefined) {
    throw new Error("Creator has neither a Slack ID nor a Hackatime ID");
  }

  const demoUrl = [p.playableDemoUrl, p.videoUrl].map((u) => u?.trim()).find((u) => u && /^https?:\/\//i.test(u));

  return {
    name: p.name,
    codeUrl: p.codeUrl,
    ...(demoUrl ? { demoUrl } : {}),
    submitter: {
      ...(slackId ? { slackId } : {}),
      ...(hackatimeId !== undefined ? { hackatimeId } : {}),
    },
    hackatimeProjects: names,
    externalId,
  };
}

/** POST a pending row to Robert. Safe to retry: Robert dedupes on externalId. */
export async function sendTelescreenSubmission(
  row: TelescreenSubmissionRow,
): Promise<TelescreenSubmissionRow> {
  if (!isTelescreenEnabled()) return row;
  try {
    const payload = await buildSubmitPayload(row.projectId, row.externalId);
    const res = await submitRobertProject(payload);
    const now = new Date();
    const updated = await updateRow(row.id, {
      robertProjectId: res.id,
      // A retry can find the project already scored; the next refresh reads the detail.
      state: res.state,
      sentAt: row.sentAt ?? now,
      lastError: null,
      lastErrorAt: null,
    });
    await withdrawSupersededSubmissions(row);
    // Already past review (a retry after a long outage): pick up score/outcome now.
    if (updated && res.state !== "awaiting_review") return refreshTelescreenSubmission(updated);
    return updated ?? row;
  } catch (err) {
    await recordError(row, err);
    return (await getRowById(row.id)) ?? row;
  }
}

async function getRowById(id: string): Promise<TelescreenSubmissionRow | null> {
  const rows = await db.select().from(telescreenSubmission).where(eq(telescreenSubmission.id, id)).limit(1);
  return rows[0] ?? null;
}

/**
 * A resubmission replaces the project's earlier entries. Withdraw the ones no
 * fraud reviewer has scored yet so they don't sit in Robert's queue; Robert
 * refuses to delete scored ones (409), which keeps their review on record.
 */
async function withdrawSupersededSubmissions(current: TelescreenSubmissionRow) {
  const older = await db
    .select()
    .from(telescreenSubmission)
    .where(
      and(
        eq(telescreenSubmission.projectId, current.projectId),
        inArray(telescreenSubmission.state, ["pending", "awaiting_review"]),
      ),
    );
  for (const row of older) {
    if (row.id === current.id || row.createdAt >= current.createdAt) continue;
    try {
      if (row.robertProjectId) {
        await deleteRobertProject(row.robertProjectId, "Carnival (superseded by a resubmission)");
      }
      await db.delete(telescreenSubmission).where(eq(telescreenSubmission.id, row.id));
    } catch (err) {
      if (err instanceof RobertApiError && err.status === 409 && row.robertProjectId) {
        // Scored in the meantime: keep it and read the score.
        await refreshTelescreenSubmission(row);
      } else if (err instanceof RobertApiError && err.status === 404) {
        await db.delete(telescreenSubmission).where(eq(telescreenSubmission.id, row.id));
      } else {
        await recordError(row, err);
      }
    }
  }
}

/** Create + send in one go — what a creator submission triggers. */
export async function submitProjectToTelescreen(projectId: string, submittedAt: Date) {
  if (!isTelescreenEnabled()) return null;
  const row = await createTelescreenSubmission(projectId, submittedAt);
  if (!row) return null;
  return sendTelescreenSubmission(row);
}

/** GET the row's Robert project and apply it. Sends the row first if it never reached Robert. */
export async function refreshTelescreenSubmission(
  row: TelescreenSubmissionRow,
): Promise<TelescreenSubmissionRow> {
  if (!isTelescreenEnabled()) return row;
  if (!row.robertProjectId) return sendTelescreenSubmission(row);
  try {
    const robert = await getRobertProject(row.robertProjectId);
    return await applyRobertProject(row, robert);
  } catch (err) {
    await recordError(row, err);
    return (await getRowById(row.id)) ?? row;
  }
}

/**
 * Store what Robert says about a submission and act on it: a fraud score
 * dismisses the project; an awaiting_outcome entry gets Carnival's pending
 * decision. Called by the webhook, the sync and staff page refreshes, so every
 * step is idempotent.
 */
export async function applyRobertProject(
  row: TelescreenSubmissionRow,
  robert: Pick<RobertProject, "state" | "trustScore" | "review" | "outcome" | "creditedSeconds">,
): Promise<TelescreenSubmissionRow> {
  const trustScore = robert.review?.trustScore ?? robert.trustScore ?? null;
  // Claim the first score so the webhook, the sync and a page refresh can't
  // all announce it.
  const firstScore =
    trustScore !== null &&
    (
      await db
        .update(telescreenSubmission)
        .set({ trustScore, updatedAt: new Date() })
        .where(and(eq(telescreenSubmission.id, row.id), isNull(telescreenSubmission.trustScore)))
        .returning({ id: telescreenSubmission.id })
    ).length > 0;
  const updated =
    (await updateRow(row.id, {
      state: robert.state,
      trustScore,
      reviewNote: robert.review?.note ?? row.reviewNote,
      reviewedAt: robert.review?.at ? new Date(robert.review.at) : row.reviewedAt,
      creditedSeconds: robert.creditedSeconds ?? row.creditedSeconds,
      outcomeStatus: robert.outcome?.status ?? null,
      outcomeReason: robert.outcome?.reason ?? null,
      outcomeAt: robert.outcome?.at ? new Date(robert.outcome.at) : null,
      ...(robert.outcome && row.carnivalOutcome === robert.outcome.status && !row.carnivalOutcomeSentAt
        ? { carnivalOutcomeSentAt: new Date() }
        : {}),
      lastSyncedAt: new Date(),
      lastError: null,
      lastErrorAt: null,
    })) ?? row;

  const band = telescreenBandForScore(trustScore);
  if (robert.state === "rejected_fraud" || band === "fraud") {
    await applyFraudRejection(updated);
  } else if (firstScore && trustScore !== null && band) {
    await notifyStaffReviewThread({
      projectId: updated.projectId,
      event: { kind: "telescreen_scored", trustScore, note: updated.reviewNote, band, action: null },
    });
  }

  if (robert.state === "awaiting_outcome" && updated.carnivalOutcome && !updated.carnivalOutcomeSentAt) {
    return pushCarnivalOutcome(updated);
  }
  return updated;
}

/**
 * A fraud score (1–4) is final. If this is the project's current submission,
 * reject and dismiss the project exactly like an admin's "Reject and dismiss":
 * back to work-in-progress, approved hours cleared, resubmission blocked.
 * The creator gets canned copy; the reviewer's note stays internal.
 */
async function applyFraudRejection(row: TelescreenSubmissionRow) {
  const now = new Date();
  const current = await getCurrentTelescreenSubmission(row.projectId);
  const isCurrent = current?.id === row.id;

  const result = await db.transaction(async (tx) => {
    // Claim the row so a webhook retry and a sync can't both act.
    const claimed = await tx
      .update(telescreenSubmission)
      .set({ fraudAppliedAt: now, updatedAt: now })
      .where(and(eq(telescreenSubmission.id, row.id), isNull(telescreenSubmission.fraudAppliedAt)))
      .returning({ id: telescreenSubmission.id });
    if (!claimed[0]) return null;

    const rows = await tx
      .select({
        status: project.status,
        name: project.name,
        creatorId: project.creatorId,
        airtableRecordId: project.airtableRecordId,
        airtableRecordIsPreview: project.airtableRecordIsPreview,
      })
      .from(project)
      .where(eq(project.id, row.projectId))
      .limit(1);
    const p = rows[0];
    if (!p) return null;
    if (!isCurrent) return { action: "superseded" as const, project: p };
    if (p.status === "granted") return { action: "already_granted" as const, project: p };

    await tx
      .update(project)
      .set({
        status: "work-in-progress",
        approvedHours: null,
        resubmissionBlocked: true,
        resubmissionBlockedAt: now,
        resubmissionBlockedBy: null,
        resubmissionBlockedReason: "Rejected by Hack Club's fraud review.",
        updatedAt: now,
      })
      .where(eq(project.id, row.projectId));
    await tx.delete(projectReviewerAssignment).where(eq(projectReviewerAssignment.projectId, row.projectId));
    return { action: "dismissed" as const, project: p };
  });
  if (!result) return;

  await notifyStaffReviewThread({
    projectId: row.projectId,
    event: {
      kind: "telescreen_scored",
      trustScore: row.trustScore ?? 0,
      note: row.reviewNote,
      band: "fraud",
      action: result.action,
    },
  });
  if (result.action !== "dismissed") return;

  // Same cleanup as leaving the grant queue: no [PREVIEW] rows linger in Airtable.
  if (result.project.airtableRecordId && result.project.airtableRecordIsPreview) {
    try {
      await deleteAirtableGrantRecord(result.project.airtableRecordId);
      await db
        .update(project)
        .set({ airtableRecordId: null, airtableRecordIsPreview: false, updatedAt: new Date() })
        .where(eq(project.id, row.projectId));
    } catch (err) {
      console.warn("[telescreen] failed to clean up preview Airtable record", err);
    }
  }

  await notifyCreatorOfFraudRejection(row.projectId, result.project.name, result.project.creatorId);
}

async function notifyCreatorOfFraudRejection(projectId: string, projectName: string, creatorId: string | null) {
  if (!creatorId) return;
  try {
    const rows = await db
      .select({ email: user.email, slackId: user.slackId })
      .from(user)
      .where(eq(user.id, creatorId))
      .limit(1);
    const creator = rows[0];
    if (!creator) return;
    const projectUrl = `${getAppBaseUrl()}/projects/${encodeURIComponent(projectId)}`;
    if (creator.email) {
      await sendReviewEmail(
        creator.email,
        `Rejected and dismissed: ${TELESCREEN_FRAUD_CREATOR_MESSAGE}`,
        "Hack Club fraud review",
        projectUrl,
      ).catch((err) => console.warn("[telescreen] fraud rejection email failed", err));
    }
    if (creator.slackId) {
      await notifyReviewDM({
        slackId: creator.slackId,
        projectName,
        status: "rejected",
        comment: TELESCREEN_FRAUD_CREATOR_MESSAGE,
        projectUrl,
        reviewerName: "Hack Club fraud review",
        creatorSlackId: creator.slackId,
      });
    }
  } catch (err) {
    console.warn("[telescreen] failed to notify creator of fraud rejection", err);
  }
}

/**
 * Remember Carnival's final decision on the project's current submission and
 * send it to Robert. Robert only takes an outcome in awaiting_outcome; until
 * then it stays queued here and the sync sends it once the score lands.
 */
export async function setCarnivalOutcome(
  projectId: string,
  outcome: { status: TelescreenOutcomeStatus; reason?: string | null },
) {
  if (!isTelescreenEnabled()) return;
  const row = await getCurrentTelescreenSubmission(projectId);
  if (!row || row.state === "rejected_fraud" || row.state === "decided") return;
  // Robert requires a reason to reject.
  const reason =
    outcome.reason?.trim() || (outcome.status === "rejected" ? "Rejected by Carnival reviewers." : null);
  const updated = await updateRow(row.id, {
    carnivalOutcome: outcome.status,
    carnivalOutcomeReason: reason,
    carnivalOutcomeSentAt: null,
  });
  if (updated) await refreshTelescreenSubmission(updated);
}

async function pushCarnivalOutcome(row: TelescreenSubmissionRow): Promise<TelescreenSubmissionRow> {
  if (!row.robertProjectId || !row.carnivalOutcome) return row;
  try {
    const res = await recordRobertOutcome(row.robertProjectId, {
      status: row.carnivalOutcome,
      reason: row.carnivalOutcomeReason,
    });
    const now = new Date();
    return (
      (await updateRow(row.id, {
        state: res.state,
        outcomeStatus: res.outcome?.status ?? row.carnivalOutcome,
        outcomeReason: res.outcome?.reason ?? row.carnivalOutcomeReason,
        outcomeAt: res.outcome?.at ? new Date(res.outcome.at) : now,
        carnivalOutcomeSentAt: now,
        lastError: null,
        lastErrorAt: null,
      })) ?? row
    );
  } catch (err) {
    await recordError(row, err);
    return (await getRowById(row.id)) ?? row;
  }
}

/**
 * The grant gate for a project, read from Telescreen live (so a score given a
 * minute ago counts). Falls back to the stored row when Robert is unreachable.
 */
export async function getTelescreenGrantGate(
  projectId: string,
): Promise<{ gate: TelescreenGate; submission: TelescreenSubmissionView | null }> {
  const enabled = isTelescreenEnabled();
  let row = await getCurrentTelescreenSubmission(projectId);
  if (enabled && row && row.state !== "rejected_fraud" && row.state !== "decided") {
    row = await refreshTelescreenSubmission(row);
  }
  const submission = row ? toTelescreenView(row) : null;
  return { gate: evaluateTelescreenGrantGate({ enabled, submission }), submission };
}

/**
 * Make sure a project that is in the review pipeline has a Telescreen entry,
 * creating one for projects submitted before this integration existed.
 */
export async function ensureTelescreenSubmission(projectId: string): Promise<TelescreenSubmissionRow | null> {
  if (!isTelescreenEnabled()) return null;
  const existing = await getCurrentTelescreenSubmission(projectId);
  if (existing) return refreshTelescreenSubmission(existing);
  const rows = await db
    .select({ status: project.status, submittedAt: project.submittedAt, createdAt: project.createdAt })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);
  const p = rows[0];
  if (!p || (p.status !== "in-review" && p.status !== "shipped")) return null;
  return submitProjectToTelescreen(projectId, p.submittedAt ?? p.createdAt);
}

export const TELESCREEN_OPEN_STATES: TelescreenState[] = ["pending", "awaiting_review", "awaiting_outcome"];

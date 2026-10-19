/**
 * Background reconciliation with Robert. Webhooks only fire for final outcomes,
 * so a 5–10 score (awaiting_outcome) is only learned by reading it back. This
 * also retries sends that failed and backfills projects that were already in
 * review when the integration was switched on.
 *
 * Runs after staff load the review queue, throttled per server instance.
 */
import { and, eq, inArray, isNull, notExists } from "drizzle-orm";
import { db } from "@/db";
import { project, telescreenSubmission } from "@/db/schema";
import { isTelescreenEnabled, listRobertProjects, type RobertProject, type RobertState } from "./client";
import { applyRobertProject, sendTelescreenSubmission, submitProjectToTelescreen } from "./submissions";

const SYNC_INTERVAL_MS = 60_000;
// Per run, so one sync never makes hundreds of Robert calls.
const MAX_SENDS_PER_RUN = 10;
const MAX_PAGES_PER_STATE = 10;

let lastSyncStartedAt = 0;
let running = false;

export async function syncTelescreen(options: { force?: boolean } = {}) {
  if (!isTelescreenEnabled() || running) return;
  if (!options.force && Date.now() - lastSyncStartedAt < SYNC_INTERVAL_MS) return;
  running = true;
  lastSyncStartedAt = Date.now();
  try {
    await applyRemoteStates();
    await retryPendingSends();
    await backfillProjectsInReview();
  } catch (err) {
    console.error("[telescreen] sync failed", err);
  } finally {
    running = false;
  }
}

async function listAll(state: RobertState): Promise<RobertProject[]> {
  const out: RobertProject[] = [];
  for (let page = 0; page < MAX_PAGES_PER_STATE; page++) {
    const res = await listRobertProjects({ state, limit: 100, offset: page * 100 });
    out.push(...res.projects);
    if (res.projects.length < 100 || out.length >= res.total) break;
  }
  return out;
}

/** Scores waiting on us, plus fraud rejections whose webhook we may have missed. */
async function applyRemoteStates() {
  const remote = [...(await listAll("awaiting_outcome")), ...(await listAll("rejected_fraud"))];
  if (remote.length === 0) return;
  const byId = new Map(remote.map((p) => [p.id, p]));
  const local = await db
    .select()
    .from(telescreenSubmission)
    .where(inArray(telescreenSubmission.robertProjectId, [...byId.keys()]));
  for (const row of local) {
    const r = row.robertProjectId ? byId.get(row.robertProjectId) : undefined;
    if (!r) continue;
    const trustScore = r.review?.trustScore ?? r.trustScore ?? null;
    const changed = row.state !== r.state || row.trustScore !== trustScore;
    const needsAction =
      (r.state === "rejected_fraud" && !row.fraudAppliedAt) ||
      (r.state === "awaiting_outcome" && row.carnivalOutcome && !row.carnivalOutcomeSentAt);
    if (changed || needsAction) await applyRobertProject(row, r);
  }
}

async function retryPendingSends() {
  const pending = await db
    .select()
    .from(telescreenSubmission)
    .where(and(eq(telescreenSubmission.state, "pending"), isNull(telescreenSubmission.robertProjectId)))
    .orderBy(telescreenSubmission.createdAt)
    .limit(MAX_SENDS_PER_RUN);
  for (const row of pending) await sendTelescreenSubmission(row);
}

async function backfillProjectsInReview() {
  const missing = await db
    .select({ id: project.id, submittedAt: project.submittedAt, createdAt: project.createdAt })
    .from(project)
    .where(
      and(
        inArray(project.status, ["in-review", "shipped"]),
        notExists(
          db
            .select({ id: telescreenSubmission.id })
            .from(telescreenSubmission)
            .where(eq(telescreenSubmission.projectId, project.id)),
        ),
      ),
    )
    .orderBy(project.submittedAt)
    .limit(MAX_SENDS_PER_RUN);
  for (const p of missing) await submitProjectToTelescreen(p.id, p.submittedAt ?? p.createdAt);
}

/**
 * Review-flow Slack notifications (DB-aware half). The copy lives in
 * review-messages.ts; this file loads what the copy needs and sends.
 *
 * Two audiences:
 * - the creator, via DM (`notifyReviewDM`), unchanged semantics from the
 *   original src/lib/slack.ts;
 * - staff, via one channel post per submission (`notifyStaffProjectSubmitted`)
 *   whose `ts` is stored on project.review_slack_thread_ts so every later
 *   event on that submission (`notifyStaffReviewThread`) lands in its thread.
 *
 * Everything here is best-effort: missing config or Slack errors log and
 * return; they never fail the request that triggered them.
 */
import { and, desc, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { peerReview, project, user } from "@/db/schema";
import { getAppBaseUrl } from "@/lib/loops";
import { projectTypeLabel } from "@/lib/review/config";
import { getReviewChannelId, isSlackConfigured, postSlackMessage, slack } from "./slack-client";
import {
  buildCreatorReviewMessage,
  buildStaffSubmissionMessage,
  buildStaffThreadReply,
  type CreatorReviewMessageInput,
  type StaffThreadEvent,
} from "./review-messages";

export type ReviewMessage = CreatorReviewMessageInput & { slackId: string };

/** DM the creator about a review-flow event. See buildCreatorReviewMessage for semantics. */
export async function notifyReviewDM(input: ReviewMessage) {
  if (!slack || !input.slackId) return;

  const appBaseUrl = getAppBaseUrl();
  const projectUrl = input.projectUrl
    ? input.projectUrl.startsWith("/")
      ? `${appBaseUrl}${input.projectUrl}`
      : input.projectUrl
    : null;

  const result = await postSlackMessage({
    channel: input.slackId,
    text: buildCreatorReviewMessage({ ...input, projectUrl }),
  });
  if (!result.ok) console.error("[Slack] Failed to send review DM", result.error);
}

export function isSlackNudgeEnabled(): boolean {
  return isSlackConfigured();
}

/** Send a nudge as a DM. Returns whether the send succeeded. */
export async function sendNudgeDM(slackId: string, text: string): Promise<boolean> {
  if (!slackId.trim() || !text.trim()) return false;
  const result = await postSlackMessage({ channel: slackId, text });
  return result.ok;
}

export function isStaffReviewChannelEnabled(): boolean {
  return isSlackConfigured() && Boolean(getReviewChannelId());
}

function editorLabelFor(editor: string, editorOther: string | null): string {
  if (editor === "other") return editorOther?.trim() || "Other";
  return editor;
}

/**
 * Post the top-level "new submission / resubmission" message and remember its
 * `ts` on the project so follow-ups thread under it. Called from the project
 * PATCH route whenever a project transitions into "in-review".
 */
export async function notifyStaffProjectSubmitted(input: {
  projectId: string;
  isResubmission: boolean;
}): Promise<void> {
  const channel = getReviewChannelId();
  if (!slack || !channel) return;

  try {
    const rows = await db
      .select({
        id: project.id,
        name: project.name,
        editor: project.editor,
        editorOther: project.editorOther,
        projectType: project.projectType,
        hoursSpentSeconds: project.hoursSpentSeconds,
        hackatimeTotalSeconds: project.hackatimeTotalSeconds,
        creatorId: project.creatorId,
        creatorName: user.name,
        creatorSlackId: user.slackId,
      })
      .from(project)
      .leftJoin(user, eq(user.id, project.creatorId))
      .where(eq(project.id, input.projectId))
      .limit(1);
    const p = rows[0];
    if (!p) return;

    // Owner replies are stored in peer_review too (decision "comment" by the
    // creator), so "prior reviews" counts staff rows only.
    const staffReviewWhere = p.creatorId
      ? and(eq(peerReview.projectId, p.id), ne(peerReview.reviewerId, p.creatorId))
      : eq(peerReview.projectId, p.id);
    const priorReviews = await db
      .select({
        decision: peerReview.decision,
        rejectionCategory: peerReview.rejectionCategory,
        reviewComment: peerReview.reviewComment,
      })
      .from(peerReview)
      .where(staffReviewWhere)
      .orderBy(desc(peerReview.createdAt));

    const rejections = priorReviews.filter((r) => r.decision === "rejected");
    const lastRejection = rejections[0] ?? null;

    const text = buildStaffSubmissionMessage({
      projectName: p.name,
      reviewUrl: `${getAppBaseUrl()}/review/${encodeURIComponent(p.id)}`,
      creatorName: p.creatorName || "A participant",
      creatorSlackId: p.creatorSlackId,
      editorLabel: editorLabelFor(p.editor, p.editorOther),
      projectTypeLabel: projectTypeLabel(p.projectType),
      devlogSeconds: p.hoursSpentSeconds,
      hackatimeSeconds: p.hackatimeTotalSeconds,
      isResubmission: input.isResubmission,
      submissionNumber: rejections.length + 1,
      priorReviewCount: priorReviews.length,
      lastRejectionCategory: lastRejection?.rejectionCategory ?? null,
      lastRejectionComment: lastRejection?.reviewComment ?? null,
    });

    const result = await postSlackMessage({ channel, text });
    if (!result.ok) return;

    await db
      .update(project)
      .set({ reviewSlackThreadTs: result.ts })
      .where(eq(project.id, p.id));
  } catch (err) {
    console.error("[Slack] notifyStaffProjectSubmitted failed", err);
  }
}

/**
 * Reply in the submission's thread. Falls back to a standalone channel post
 * when the project has no stored thread (submitted before this feature, or
 * the original post failed) so staff never miss an event.
 */
export async function notifyStaffReviewThread(input: {
  projectId: string;
  event: StaffThreadEvent;
}): Promise<void> {
  const channel = getReviewChannelId();
  if (!slack || !channel) return;

  try {
    const rows = await db
      .select({ name: project.name, threadTs: project.reviewSlackThreadTs })
      .from(project)
      .where(eq(project.id, input.projectId))
      .limit(1);
    const p = rows[0];
    if (!p) return;

    const reply = buildStaffThreadReply(p.name, input.event);
    const text = p.threadTs
      ? reply
      : `${reply}\n${`<${getAppBaseUrl()}/review/${encodeURIComponent(input.projectId)}|Open review →>`}`;
    await postSlackMessage({ channel, text, threadTs: p.threadTs });
  } catch (err) {
    console.error("[Slack] notifyStaffReviewThread failed", err);
  }
}

/** Slack IDs of every admin and reviewer (used by scripts and future fan-outs). */
export async function listStaffSlackIds(): Promise<string[]> {
  const rows = await db
    .select({ slackId: user.slackId })
    .from(user)
    .where(and(inArray(user.role, ["admin", "reviewer"]), isNotNull(user.slackId)));
  return rows.map((r) => r.slackId?.trim()).filter((v): v is string => Boolean(v));
}

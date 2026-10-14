/**
 * Pure message builders for review-flow Slack messages. No DB or Slack
 * imports so the copy can be unit tested (review-messages.test.mjs) and
 * previewed from scripts/notifications/post-sample.ts.
 *
 * Slack mrkdwn: user-supplied text (project names, comments) is escaped so a
 * stray "<" or "&" can't break links or mentions.
 */

export type CreatorReviewStatus = "submitted" | "approved" | "rejected" | "comment" | "shipped";

export type CreatorReviewMessageInput = {
  projectName: string;
  status: CreatorReviewStatus;
  comment?: string | null;
  projectUrl?: string | null;
  reviewerSlackId?: string | null;
  reviewerName?: string | null;
  reviewerId?: string | null;
  creatorSlackId?: string | null;
  /** "submitted" only: the project has been in review before. */
  isResubmission?: boolean;
};

export type StaffSubmissionMessageInput = {
  projectName: string;
  reviewUrl: string;
  creatorName: string;
  creatorSlackId: string | null;
  editorLabel: string;
  projectTypeLabel: string;
  devlogSeconds: number;
  hackatimeSeconds: number | null;
  isResubmission: boolean;
  /** 1 for a first submission, 2 for the first resubmission, ... */
  submissionNumber: number;
  priorReviewCount: number;
  lastRejectionCategory: string | null;
  lastRejectionComment: string | null;
};

export type StaffThreadEvent =
  | {
      kind: "reviewer_decision";
      decision: "approved" | "rejected" | "comment";
      reviewerName: string;
      reviewerSlackId: string | null;
      comment: string;
      approvedHours: number | null;
      dismissed: boolean;
      rejectionCategory: string | null;
    }
  | {
      kind: "owner_comment";
      creatorName: string;
      creatorSlackId: string | null;
      comment: string;
    }
  | {
      kind: "granted";
      approvedHours: number | null;
      tokensIssued: number;
    };

const STAFF_COMMENT_PREVIEW_MAX = 600;

export function escapeSlackText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function slackLink(url: string, label: string): string {
  return `<${url}|${escapeSlackText(label)}>`;
}

export function mentionOrName(slackId: string | null | undefined, name: string): string {
  const id = slackId?.trim();
  return id ? `<@${id}>` : escapeSlackText(name);
}

export function truncateForSlack(value: string, max = STAFF_COMMENT_PREVIEW_MAX): string {
  const text = value.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function formatHoursFromSeconds(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.floor(seconds ?? 0));
  if (s === 0) return "0h";
  const hours = s / 3600;
  if (hours >= 10) return `${Math.round(hours)}h`;
  return `${hours.toFixed(1).replace(/\.0$/, "")}h`;
}

/** Format an admin-chosen reject category key ("ai-slop") for humans. */
export function formatRejectionCategory(category: string | null | undefined): string | null {
  const key = category?.trim();
  if (!key) return null;
  return key.replace(/[-_]+/g, " ");
}

/** Quote a comment as a mrkdwn blockquote (every line prefixed with ">"). */
export function blockquote(text: string): string {
  return escapeSlackText(truncateForSlack(text))
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

/**
 * Copy for the creator's DM. Status semantics are deliberate:
 * - "submitted" is sent when the project enters (or re-enters) review;
 * - "approved" is sent ONLY at grant time (pass 2), never on pass-1 approval,
 *   so the tokens really have been credited when the creator reads it;
 * - "rejected" and "comment" are sent immediately by the reviewer flow.
 */
export function buildCreatorReviewMessage(input: CreatorReviewMessageInput): string {
  const ownerMention = input.creatorSlackId?.trim();
  const hey = ownerMention ? `Hey <@${ownerMention}>,` : "Hey,";
  const projectLabel = input.projectUrl
    ? slackLink(input.projectUrl, input.projectName)
    : `*${escapeSlackText(input.projectName)}*`;

  const statusLines: Record<CreatorReviewStatus, string[]> = {
    submitted: input.isResubmission
      ? ["🎪 We got your resubmission.", "A reviewer will take another look soon."]
      : ["🎪 We got your submission.", "A reviewer will take a look soon."],
    approved: [
      hey,
      "✅ Congrats! Your project was approved and granted.",
      "Your tokens have been credited to your Carnival wallet. If you don't see them, please DM @Josias!",
    ],
    rejected: [
      hey,
      "❌ Your project is rejected for now and needs more work.",
      "See the reviewer notes and iterate, then resubmit for a re-review.",
    ],
    comment: [hey, "💬 A reviewer left feedback on your project.", "Check the notes and follow up if needed."],
    shipped: [hey, "🚢 Your project is shipped!", "Nice work—share your launch and keep building."],
  };

  const by = input.reviewerSlackId?.trim()
    ? `*By:* <@${input.reviewerSlackId.trim()}>`
    : input.reviewerName?.trim()
      ? `*By:* ${escapeSlackText(input.reviewerName.trim())}${
          input.reviewerId ? ` (${escapeSlackText(input.reviewerId)})` : ""
        }`
      : input.reviewerId
        ? `*By:* ${escapeSlackText(input.reviewerId)}`
        : null;

  const lines: (string | null)[] = [
    ...statusLines[input.status],
    `*Project:* ${projectLabel}`,
    `*Status:* ${input.status}`,
    input.comment?.trim() ? `*Comment:*\n${blockquote(input.comment)}` : null,
    by,
  ];
  return lines.filter(Boolean).join("\n");
}

/** Top-level post in the staff review channel; later events reply in its thread. */
export function buildStaffSubmissionMessage(input: StaffSubmissionMessageInput): string {
  const headline = input.isResubmission
    ? `🔁 *Resubmission #${Math.max(2, input.submissionNumber)}:* ${slackLink(input.reviewUrl, input.projectName)}`
    : `🎪 *New submission:* ${slackLink(input.reviewUrl, input.projectName)}`;

  const facts = [
    `*Creator:* ${mentionOrName(input.creatorSlackId, input.creatorName)}`,
    `*Type:* ${escapeSlackText(input.projectTypeLabel)} · ${escapeSlackText(input.editorLabel)}`,
    `*Hours:* ${formatHoursFromSeconds(input.devlogSeconds)} in devlogs${
      input.hackatimeSeconds !== null ? ` · ${formatHoursFromSeconds(input.hackatimeSeconds)} Hackatime` : ""
    }`,
  ];

  const history: string[] = [];
  if (input.isResubmission) {
    history.push(
      `*History:* ${input.priorReviewCount} prior review${input.priorReviewCount === 1 ? "" : "s"}`,
    );
    const category = formatRejectionCategory(input.lastRejectionCategory);
    if (category) history.push(`*Last rejection:* ${escapeSlackText(category)}`);
    if (input.lastRejectionComment?.trim()) {
      history.push(blockquote(truncateForSlack(input.lastRejectionComment, 300)));
    }
  }

  return [headline, ...facts, ...history, `${slackLink(input.reviewUrl, "Open review →")}`].join("\n");
}

/** Thread reply under the submission post (or a standalone post when the thread is unknown). */
export function buildStaffThreadReply(projectName: string, event: StaffThreadEvent): string {
  const name = `*${escapeSlackText(projectName)}*`;
  switch (event.kind) {
    case "reviewer_decision": {
      const who = mentionOrName(event.reviewerSlackId, event.reviewerName);
      const head =
        event.decision === "approved"
          ? `✅ ${who} approved ${name} (pass 1)${
              event.approvedHours !== null ? ` · ${event.approvedHours}h approved` : ""
            } — ready for the grant page.`
          : event.decision === "rejected"
            ? `${event.dismissed ? "⛔" : "❌"} ${who} ${event.dismissed ? "rejected and dismissed" : "rejected"} ${name}${
                formatRejectionCategory(event.rejectionCategory)
                  ? ` · ${escapeSlackText(formatRejectionCategory(event.rejectionCategory) as string)}`
                  : ""
              }.`
            : `💬 ${who} commented on ${name}.`;
      return event.comment.trim() ? `${head}\n${blockquote(event.comment)}` : head;
    }
    case "owner_comment": {
      const who = mentionOrName(event.creatorSlackId, event.creatorName);
      return `🗣️ ${who} (creator) replied on ${name}:\n${blockquote(event.comment)}`;
    }
    case "granted":
      return `🎉 ${name} granted${
        event.approvedHours !== null ? ` · ${event.approvedHours}h` : ""
      } · ${event.tokensIssued} tokens credited.`;
  }
}

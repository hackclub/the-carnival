/**
 * Post a synthetic submission + thread of review events to the staff review
 * channel, so the copy can be checked without touching the database.
 *
 *   SLACK_REVIEW_CHANNEL_ID=C0123456789 bun scripts/notifications/post-sample.ts
 *   bun scripts/notifications/post-sample.ts C0123456789        # channel as arg
 *
 * Needs SLACK_BOT_TOKEN (bun loads .env / .env.local automatically) and the bot
 * invited to the channel. Pure builders only; no DB access.
 */
export {};

const channel = (process.argv[2] ?? process.env.SLACK_REVIEW_CHANNEL_ID ?? "").trim();
if (!channel) {
  throw new Error("Pass a channel ID as the first argument or set SLACK_REVIEW_CHANNEL_ID.");
}

const { postSlackMessage } = await import("../../src/lib/notifications/slack-client");
const { buildStaffSubmissionMessage, buildStaffThreadReply } = await import(
  "../../src/lib/notifications/review-messages"
);

const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://carnival.hackclub.com";
const projectName = "Sample: Tab Rot <VS Code>";
const reviewUrl = `${appBaseUrl}/review/sample-project-id`;

const submissionPost = await postSlackMessage({
  channel,
  text: buildStaffSubmissionMessage({
    projectName,
    reviewUrl,
    creatorName: "Ada Lovelace",
    creatorSlackId: process.env.SLACK_USER_ID ?? null,
    editorLabel: "vscode",
    projectTypeLabel: "Extension / Plugin",
    devlogSeconds: 7.5 * 3600,
    hackatimeSeconds: 8.2 * 3600,
    isResubmission: true,
    submissionNumber: 2,
    priorReviewCount: 2,
    lastRejectionCategory: "unclear-readme",
    lastRejectionComment: "The README doesn't explain what the extension does. Please add a short description & a screenshot.",
  }),
});
if (!submissionPost.ok) throw new Error(`Top-level post failed: ${submissionPost.error}`);
console.log("posted submission", submissionPost.ts);

const replies = [
  buildStaffThreadReply(projectName, {
    kind: "owner_comment",
    creatorName: "Ada Lovelace",
    creatorSlackId: null,
    comment: "Updated the README with a description and two screenshots — ready for another look!",
  }),
  buildStaffThreadReply(projectName, {
    kind: "reviewer_decision",
    decision: "approved",
    reviewerName: "Grace Hopper",
    reviewerSlackId: null,
    comment: "Solid work. Deflated 0.7h of idle time; everything else checks out.",
    approvedHours: 7.5,
    dismissed: false,
    rejectionCategory: null,
  }),
  buildStaffThreadReply(projectName, { kind: "granted", approvedHours: 7.5, tokensIssued: 75 }),
];
for (const text of replies) {
  const r = await postSlackMessage({ channel, text, threadTs: submissionPost.ts });
  console.log(r.ok ? "posted reply" : `reply failed: ${r.error}`);
}

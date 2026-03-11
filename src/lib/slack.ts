import { WebClient } from "@slack/web-api";

const token = process.env.SLACK_BOT_TOKEN?.trim();
export const slack = token ? new WebClient(token) : null;

type ReviewMessage = {
	slackId: string;
	projectName: string;
	status: "submitted" | "approved" | "rejected" | "comment" | "shipped";
	comment?: string;
	projectUrl?: string;
	reviewerSlackId?: string;
	reviewerName?: string;
	reviewerId?: string;
	creatorSlackId?: string;
};

export async function notifyReviewDM(input: ReviewMessage) {
	if (!slack || !input.slackId) return;

	const ownerMention = input.creatorSlackId || input.slackId;
	const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://carnival.hackclub.com";
	const projectLink = input.projectUrl
		? input.projectUrl.startsWith("/")
			? `${appBaseUrl}${input.projectUrl}`
			: input.projectUrl
		: null;

	const statusLines: Record<ReviewMessage["status"], string[]> = {
		submitted: [
			"🎪 We got your submission.",
			"A reviewer will take a look soon.",
		],
		approved: [
			`Hey${ownerMention ? ` <@${ownerMention}>` : ""},`,
			"✅ Congrats! Your project was approved.",
			"We’ll mark it as shipped and your payout should be credited within next few minutes !. If not , please DM @Josias !",
		],
		rejected: [
			`Hey${ownerMention ? ` <@${ownerMention}>` : ""},`,
			"❌ Your project is rejected for now and needs more work.",
			"See the reviewer notes and iterate, then resubmit for a re-review.",
		],
		comment: [
			`Hey${ownerMention ? ` <@${ownerMention}>` : ""}`,
			"💬 A reviewer left feedback on your project.",
			"Check the notes and follow up if needed.",
		],
		shipped: [
			`Hey${ownerMention ? ` <@${ownerMention}>` : ""}`,
			"🚢 Your project is shipped!",
			"Nice work—share your launch and keep building.",
		],
	};

	const lines: (string | null)[] = [
		...(statusLines[input.status] ?? []),
		`Project: ${input.projectName}`,
		`Status: ${input.status}`,
		input.comment ? `Comment: ${input.comment}` : null,
		input.reviewerSlackId
			? `By: <@${input.reviewerSlackId}>`
			: input.reviewerName
				? `By: ${input.reviewerName}${input.reviewerId ? ` (${input.reviewerId})` : ""}`
				: input.reviewerId
					? `By: ${input.reviewerId}`
					: null,
		projectLink ? `Link: ${projectLink}` : null,
	];

	try {
		await slack.chat.postMessage({
			channel: input.slackId,
			text: lines.filter(Boolean).join("\n"),
		});
	} catch (err) {
		console.error("[Slack] Failed to send review DM", err);
	}
}
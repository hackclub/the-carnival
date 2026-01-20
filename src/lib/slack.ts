import { WebClient } from "@slack/web-api";

const token = process.env.SLACK_BOT_TOKEN?.trim();
export const slack = token ? new WebClient(token) : null;

type ReviewMessage = {
	slackId: string;
	projectName: string;
	status: "submitted" | "approved" | "rejected" | "comment" | "shipped";
	comment?: string;
	projectUrl?: string;
	reviewerId?: string;
	reviewerName?: string;
};

export async function notifyReviewDM(input: ReviewMessage) {
	if (!slack || !input.slackId) return;

	const lines = [
		"Hey",
		`Project: ${input.projectName}`,
		`Status: ${input.status}`,
		input.comment ? `Reviewer: ${input.comment}` : null,
		input.reviewerName ? `By: ${input.reviewerName}${input.reviewerId ? ` (${input.reviewerId})` : ""}` : input.reviewerId ? `By: ${input.reviewerId}` : null,
		input.projectUrl ? `Link: ${input.projectUrl}` : null,
	].filter(Boolean) as string[];

	try {
		await slack.chat.postMessage({
			channel: input.slackId,
			text: lines.join("\n"),
		});
	} catch (error) {
		console.error("Failed to send Slack notification:", error);
		// Don't throw - we don't want to crash the application if Slack notifications fail
	}
}
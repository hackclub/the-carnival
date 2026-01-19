import { WebClient, type KnownBlock } from "@slack/web-api";

const token = process.env.SLACK_BOT_TOKEN?.trim();
export const slack = token ? new WebClient(token) : null;

type ReviewMessage = {
	slackId: string;
	projectName: string;
	status: "submitted" | "in-review" | "approved" | "rejected" | "comment";
	comment?: string;
	projectUrl?: string;
};

export async function notifyReviewDM(input: ReviewMessage) {
	if (!slack || !input.slackId) return;

	const lines = [
		`Project: ${input.projectName}`,
		`Status: ${input.status}`,
		input.comment ? `Reviewer: ${input.comment}` : null,
		input.projectUrl ? `Link: ${input.projectUrl}` : null,
	].filter(Boolean) as string[];

	await slack.chat.postMessage({
		channel: input.slackId,
		text: lines.join("\n"),
	});
}
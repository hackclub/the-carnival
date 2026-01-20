import { notifyReviewDM } from "../src/lib/slack";

void (async () => {
  const slackId = process.env.SLACK_USER_ID;
  if (!slackId) {
    throw new Error("Environment variable SLACK_USER_ID must be set to send a manual Slack DM.");
  }

  await notifyReviewDM({
    slackId,
    projectName: "Test Project",
    status: "approved",
    comment: "Manual test DM",
    projectUrl: "https://example.com",
  });

  console.log("sent");
})();
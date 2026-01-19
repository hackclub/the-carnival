import { notifyReviewDM } from "../src/lib/slack";

void (async () => {
  await notifyReviewDM({
    slackId: "U082UPTRQU8", // your real Slack user ID
    projectName: "Test Project",
    status: "approved",
    comment: "Manual test DM",
    projectUrl: "https://example.com",
  });

  console.log("sent");
})();
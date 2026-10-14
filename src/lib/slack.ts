// Compatibility shim: the Slack integration now lives in src/lib/notifications/.
// Existing call sites keep importing from "@/lib/slack".
export { slack, isSlackConfigured, postSlackMessage } from "@/lib/notifications/slack-client";
export {
  notifyReviewDM,
  sendNudgeDM,
  isSlackNudgeEnabled,
  isStaffReviewChannelEnabled,
  notifyStaffProjectSubmitted,
  notifyStaffReviewThread,
  type ReviewMessage,
} from "@/lib/notifications/review-events";

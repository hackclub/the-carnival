-- Staff review channel: remember the Slack `ts` of the submission post so
-- later review events (decisions, owner replies, grant) thread under it.
ALTER TABLE "project" ADD COLUMN "review_slack_thread_ts" text;

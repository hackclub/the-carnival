-- Automated Slack nudges: per-user opt-out (toggle on /account).
ALTER TABLE "user" ADD COLUMN "slack_nudges_opt_out" boolean DEFAULT false NOT NULL;

-- Store reviewer-approved hours for a review (primarily used on approvals)
ALTER TABLE "peer_review" ADD COLUMN IF NOT EXISTS "approved_hours" integer;


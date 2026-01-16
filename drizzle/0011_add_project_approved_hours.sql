-- Store canonical approved hours on the project (set by reviewer on approval)
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "approved_hours" integer;


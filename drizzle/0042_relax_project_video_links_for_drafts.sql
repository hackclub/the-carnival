ALTER TABLE "project" DROP CONSTRAINT IF EXISTS "project_video_links_not_empty";

ALTER TABLE "project"
  ADD CONSTRAINT "project_video_links_not_empty"
  CHECK (
    "status" = 'work-in-progress'
    OR ("video_url" <> '' AND "playable_demo_url" <> '')
  ) NOT VALID;

ALTER TABLE "project" DROP CONSTRAINT "project_playable_links_not_empty";
ALTER TABLE "project" RENAME COLUMN "playable_url" TO "video_url";
ALTER TABLE "project" RENAME COLUMN "playable_link_url" TO "playable_demo_url";
ALTER TABLE "project"
  ADD CONSTRAINT "project_video_links_not_empty"
  CHECK ("video_url" <> '' AND "playable_demo_url" <> '') NOT VALID;

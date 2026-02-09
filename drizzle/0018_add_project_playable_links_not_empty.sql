UPDATE "project"
  SET "playable_link_url" = "playable_url"
  WHERE "playable_link_url" = '' AND "playable_url" <> '';

ALTER TABLE "project"
  ADD CONSTRAINT "project_playable_links_not_empty"
  CHECK ("playable_url" <> '' AND "playable_link_url" <> '') NOT VALID;

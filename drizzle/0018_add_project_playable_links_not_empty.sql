ALTER TABLE "project"
  ADD CONSTRAINT "project_playable_links_not_empty"
  CHECK ("playable_url" <> '' AND "playable_link_url" <> '');

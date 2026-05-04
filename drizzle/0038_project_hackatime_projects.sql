CREATE TABLE "project_hackatime_project" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "name" text NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "first_devlog_id" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_hackatime_project" ADD CONSTRAINT "project_hackatime_project_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_hackatime_project" ADD CONSTRAINT "project_hackatime_project_first_devlog_id_devlog_id_fk" FOREIGN KEY ("first_devlog_id") REFERENCES "public"."devlog"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "project_hackatime_project_project_name_uniq" ON "project_hackatime_project" USING btree ("project_id","name");
--> statement-breakpoint
CREATE INDEX "project_hackatime_project_project_default_idx" ON "project_hackatime_project" USING btree ("project_id","is_default");
--> statement-breakpoint
INSERT INTO "project_hackatime_project" (
  "id",
  "project_id",
  "name",
  "is_default",
  "first_devlog_id",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()::text,
  p."id",
  trim(p."hackatime_project_name"),
  true,
  NULL,
  now(),
  now()
FROM "project" p
WHERE trim(COALESCE(p."hackatime_project_name", '')) <> ''
ON CONFLICT DO NOTHING;

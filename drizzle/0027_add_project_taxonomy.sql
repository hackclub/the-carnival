ALTER TABLE "project" ADD COLUMN "category" text;
ALTER TABLE "project" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;

CREATE TYPE "public"."devlog_category" AS ENUM('learning', 'design', 'coding');
ALTER TABLE "devlog" ADD COLUMN "category" "devlog_category" DEFAULT 'coding' NOT NULL;

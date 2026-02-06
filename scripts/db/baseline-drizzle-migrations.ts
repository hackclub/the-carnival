import { config as loadEnv } from "dotenv";
import fs from "node:fs";
import crypto from "node:crypto";
import postgres from "postgres";

// Load env (prefer .env.local over .env) like drizzle.config.ts
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set (.env.local recommended).");
  process.exit(1);
}

const DRIZZLE_DIR = "drizzle";
const JOURNAL_PATH = `${DRIZZLE_DIR}/meta/_journal.json`;

if (!fs.existsSync(JOURNAL_PATH)) {
  console.error(`Missing ${JOURNAL_PATH}.`);
  process.exit(1);
}

type Journal = {
  entries: Array<{ idx: number; when: number; tag: string; breakpoints: boolean; version?: string }>;
};

const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, "utf8")) as Journal;
const entries = journal.entries ?? [];
if (entries.length === 0) {
  console.error("No journal entries found.");
  process.exit(1);
}

const toArg = process.argv.find((a) => a.startsWith("--to="));
const toTag = (() => {
  if (toArg) return toArg.split("=").slice(1).join("=");
  // Default: baseline up to the second-to-last migration,
  // leaving the newest migration to be applied via `db:migrate`.
  return entries.length >= 2 ? entries[entries.length - 2]!.tag : entries[entries.length - 1]!.tag;
})();

const target = entries.find((e) => e.tag === toTag);
if (!target) {
  console.error(`Tag not found in journal: ${toTag}`);
  process.exit(1);
}

const migrationPath = `${DRIZZLE_DIR}/${target.tag}.sql`;
if (!fs.existsSync(migrationPath)) {
  console.error(`Missing migration file: ${migrationPath}`);
  process.exit(1);
}

const migrationSql = fs.readFileSync(migrationPath, "utf8");
const hash = crypto.createHash("sha256").update(migrationSql).digest("hex");

const sql = postgres(DATABASE_URL);

try {
  await sql.unsafe('CREATE SCHEMA IF NOT EXISTS "drizzle"');
  await sql.unsafe(
    'CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)',
  );

  const countRows = await sql.unsafe(
    'select count(*)::int as c from "drizzle"."__drizzle_migrations"',
  );
  const count = Number((countRows as Array<{ c: number }>)[0]?.c ?? 0);

  if (count > 0) {
    console.log(`Baseline not needed: __drizzle_migrations already has ${count} row(s).`);
    process.exit(0);
  }

  await sql.unsafe(
    `insert into "drizzle"."__drizzle_migrations" ("hash","created_at") values ('${hash}','${target.when}')`,
  );

  console.log(`Baselined migrations to "${target.tag}" (created_at=${target.when}).`);
  console.log("Now run: bun run db:migrate");
} finally {
  await sql.end({ timeout: 5 });
}


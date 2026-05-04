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

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
if (args.has("--help") || args.has("-h")) {
  const last = entries[entries.length - 1]!.tag;
  const prev = entries.length >= 2 ? entries[entries.length - 2]!.tag : last;
  console.log(`Usage: bun scripts/db/baseline-drizzle-migrations.ts [options]

Drizzle "migrate" only looks at the latest row in drizzle.__drizzle_migrations
(ordered by created_at). If that table is empty, it replays every .sql file from
0000 — which fails with "relation already exists" on an existing database.

This script inserts one watermark row so only newer migrations run.

Options:
  --to=<tag>   Journal tag to stamp as the last applied migration (default: second-to-last
               in the journal, so the newest file is left for db:migrate).
  --to=last    Stamp the latest journal entry (use when the DB already matches HEAD).
  --force      Delete existing rows in __drizzle_migrations before inserting (required if the
               table exists but is empty/wrong and db:migrate fails on 0000).

Examples (DB already has all tables through Carnival devlogs v1, need 0033 only):
  bun run db:baseline -- --force
  bun run db:migrate

Examples (DB fully matches repo including latest migration; fix empty migration table only):
  bun run db:baseline -- --to=last --force
  bun run db:migrate

Current journal tail: … ${prev} → ${last}`);
  process.exit(0);
}

const toArg = process.argv.find((a) => a.startsWith("--to="));
const toTag = (() => {
  if (toArg) {
    const v = toArg.split("=").slice(1).join("=");
    if (v === "last") return entries[entries.length - 1]!.tag;
    return v;
  }
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
  const count = Number(((countRows as unknown) as Array<{ c: number }>)[0]?.c ?? 0);

  if (count > 0 && !force) {
    console.log(`__drizzle_migrations already has ${count} row(s). Nothing to do.`);
    console.log("");
    console.log(
      "If `bun run db:migrate` fails replaying 0000 with \"already exists\", the table may be",
    );
    console.log("out of sync. Truncate and stamp the correct tag, then migrate:");
    console.log("");
    console.log("  bun run db:baseline -- --force");
    console.log("  bun run db:migrate");
    console.log("");
    console.log("If your database already includes every migration in the repo, use:");
    console.log("");
    console.log("  bun run db:baseline -- --to=last --force");
    console.log("  bun run db:migrate");
    process.exit(0);
  }

  if (count > 0 && force) {
    await sql.unsafe('TRUNCATE TABLE "drizzle"."__drizzle_migrations" RESTART IDENTITY');
    console.log(`Cleared ${count} existing migration row(s) (--force).`);
  }

  await sql.unsafe(
    `insert into "drizzle"."__drizzle_migrations" ("hash","created_at") values ('${hash}','${target.when}')`,
  );

  console.log(`Baselined migrations to "${target.tag}" (created_at=${target.when}).`);
  console.log("Now run: bun run db:migrate");
} finally {
  await sql.end({ timeout: 5 });
}

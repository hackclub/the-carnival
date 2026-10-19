/**
 * Automated Slack nudges, as a one-shot command.
 *
 * In production this file is bundled into the app image as scripts/nudges.js
 * (see Dockerfile) and run daily by a Coolify scheduled task:
 *
 *   bun scripts/nudges.js --send          # what the scheduled task runs
 *   bun scripts/nudges.js                 # dry run: counts + sample copy
 *   bun scripts/nudges.js --send --max 25 --allow U0123456789
 *   bun scripts/nudges.js --json          # full result as JSON
 *
 * Locally: `bun scripts/nudges/run.ts` with the same flags (bun loads .env).
 * Sending also requires NUDGES_ENABLED=true; every other rail lives in
 * runNudges(). A Postgres advisory lock stops two runs overlapping.
 */
import postgres from "postgres";
import { parseNudgeCommandArgs, runNudgeCommand } from "@/lib/notifications/nudges/command";
import { runNudges } from "@/lib/notifications/nudges/run";

// Reject bad flags before taking the lock or touching anything.
const parsed = parseNudgeCommandArgs(process.argv.slice(2));
if (!parsed.ok) {
  console.error(parsed.error);
  process.exit(2);
}

// Arbitrary constant shared by every copy of the command.
const NUDGE_LOCK_KEY = 0x6e756467;

// The advisory lock is session-scoped, so it gets its own single connection
// that stays open for the whole run. runNudges() uses the app's pool.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const lockSql = postgres(databaseUrl, { max: 1, idle_timeout: 0 });

const exitCode = await runNudgeCommand(parsed.args, {
  async tryLock() {
    const rows = await lockSql`select pg_try_advisory_lock(${NUDGE_LOCK_KEY}) as locked`;
    return rows[0]?.locked === true;
  },
  async unlock() {
    await lockSql`select pg_advisory_unlock(${NUDGE_LOCK_KEY})`;
  },
  runNudges,
  log: (line) => console.log(line),
  error: (line) => console.error(line),
});

await lockSql.end({ timeout: 5 }).catch(() => undefined);
// The app's DB pool keeps the event loop alive; exit explicitly.
process.exit(exitCode);

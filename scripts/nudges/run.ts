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
import { parseNudgeCommandArgs, runNudgeCommand } from "@/lib/notifications/nudges/command";
import { createNudgeLock } from "@/lib/notifications/nudges/lock";
import { runNudges } from "@/lib/notifications/nudges/run";

// Reject bad flags before taking the lock or touching anything.
const parsed = parseNudgeCommandArgs(process.argv.slice(2));
if (!parsed.ok) {
  console.error(parsed.error);
  process.exit(2);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const lock = createNudgeLock();

const exitCode = await runNudgeCommand(parsed.args, {
  tryLock: lock.tryLock,
  unlock: lock.unlock,
  runNudges,
  log: (line) => console.log(line),
  error: (line) => console.error(line),
});

await lock.close();
// The app's DB pool keeps the event loop alive; exit explicitly.
process.exit(exitCode);

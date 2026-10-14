/**
 * Run the automated nudge planner from a shell (dry run by default).
 *
 *   bun scripts/nudges/run.ts                       # plan only, prints counts + samples
 *   bun scripts/nudges/run.ts --send --max 25       # really send (needs NUDGES_ENABLED=true)
 *   bun scripts/nudges/run.ts --send --allow U0123  # send only to these Slack IDs
 *   bun scripts/nudges/run.ts --json                # raw result as JSON
 *
 * bun loads .env / .env.local automatically. Sends go through the same
 * runNudges() the cron route uses, so every rail applies here too.
 */
export {};

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const value = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const { runNudges } = await import("../../src/lib/notifications/nudges/run");
const { NUDGE_KINDS, NUDGE_KIND_META } = await import("../../src/lib/notifications/nudges/kinds");

const maxRaw = Number(value("--max"));
const allowRaw = value("--allow");
const result = await runNudges({
  dryRun: !flag("--send"),
  maxSends: Number.isFinite(maxRaw) ? maxRaw : undefined,
  allowlist: allowRaw ? allowRaw.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
});

if (flag("--json")) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(
    `${result.dryRun ? "DRY RUN" : "LIVE RUN"} · sending ${result.sendingEnabled ? "enabled" : "disabled"} · Slack ${
      result.slackConfigured ? "configured" : "NOT configured"
    } · deadline ${result.deadlineIso ?? "unknown"} (${result.daysLeft ?? "?"} days left) · cap ${result.maxSends}${
      result.allowlist ? ` · allowlist ${result.allowlist.join(",")}` : ""
    }`,
  );
  console.table(
    NUDGE_KINDS.map((kind) => ({
      kind,
      label: NUDGE_KIND_META[kind].label,
      candidates: result.candidatesByKind[kind],
      planned: result.plannedByKind[kind],
    })),
  );
  console.log("skipped:", result.skippedByReason);
  if (!result.dryRun) console.log(`sent ${result.sent.length} · failed ${result.failed.length}`);
  if (result.recordFailed) {
    console.error(
      "A DM was sent but its user_nudge row could not be written; the run stopped. Add the row by hand before running again.",
    );
  }
  for (const sample of result.samples) {
    console.log(`\n--- ${sample.kind} / ${sample.variant} ---\n${sample.text}`);
  }
}

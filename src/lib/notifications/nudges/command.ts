/**
 * The nudge command's logic, separated from process and database plumbing
 * so it can be unit tested (command.test.mjs). Entry point:
 * scripts/nudges/run.ts, bundled into the app image as scripts/nudges.js
 * and run daily by a Coolify scheduled task.
 *
 * Exit codes (Coolify marks non-zero runs as failed):
 *   0  done, dry run, deadline passed, or another run already holds the lock
 *   1  crash; a DM was sent but could not be recorded; or every send failed
 *   2  bad arguments (rejected before the lock is taken or anything runs)
 */
import type { NudgeRunOptions, NudgeRunResult } from "./run";

export type NudgeCommandArgs = {
  send: boolean;
  json: boolean;
  maxSends?: number;
  allowlist?: string[];
};

export type ParsedNudgeCommandArgs = { ok: true; args: NudgeCommandArgs } | { ok: false; error: string };

/**
 * Parse the command's flags. Malformed `--max` / `--allow` operands are
 * rejected rather than ignored: silently falling back to the default cap
 * would turn a typo like `--send --max abc` into a full-size live run.
 * Omitting `--max` entirely still means the default cap.
 */
export function parseNudgeCommandArgs(argv: string[]): ParsedNudgeCommandArgs {
  const operand = (name: string): { present: false } | { present: true; value: string | null } => {
    const i = argv.indexOf(name);
    if (i < 0) return { present: false };
    const next = argv[i + 1];
    // A missing operand, or another flag where the operand should be.
    return { present: true, value: next === undefined || next.startsWith("--") ? null : next };
  };

  const max = operand("--max");
  let maxSends: number | undefined;
  if (max.present) {
    if (max.value === null) return { ok: false, error: "--max needs a number, e.g. --max 25" };
    if (!/^\d+$/.test(max.value.trim())) {
      return { ok: false, error: `--max must be a whole number of 0 or more (got "${max.value}")` };
    }
    maxSends = Number(max.value.trim());
  }

  const allow = operand("--allow");
  let allowlist: string[] | undefined;
  if (allow.present) {
    if (allow.value === null) return { ok: false, error: "--allow needs Slack IDs, e.g. --allow U0123ABCD,U0456EFGH" };
    allowlist = allow.value.split(",").map((s) => s.trim()).filter(Boolean);
    if (allowlist.length === 0) return { ok: false, error: "--allow needs at least one Slack ID" };
  }

  return {
    ok: true,
    args: { send: argv.includes("--send"), json: argv.includes("--json"), maxSends, allowlist },
  };
}

export type NudgeCommandDeps = {
  /** Take the cross-process lock; false when another run holds it. */
  tryLock: () => Promise<boolean>;
  unlock: () => Promise<void>;
  runNudges: (options: NudgeRunOptions) => Promise<NudgeRunResult>;
  log: (line: string) => void;
  error: (line: string) => void;
};

export function nudgeCommandExitCode(result: NudgeRunResult): number {
  if (result.recordFailed) return 1;
  // Something was due but nothing went out (e.g. Slack down or token revoked).
  if (!result.dryRun && result.planned.length > 0 && result.sent.length === 0 && result.failed.length > 0) {
    return 1;
  }
  return 0;
}

/** One-line machine-readable summary for the Coolify task log. */
export function summarizeNudgeRun(result: NudgeRunResult) {
  return {
    event: "nudge_run",
    dryRun: result.dryRun,
    sendingEnabled: result.sendingEnabled,
    slackConfigured: result.slackConfigured,
    deadlineIso: result.deadlineIso,
    daysLeft: result.daysLeft,
    maxSends: result.maxSends,
    allowlist: result.allowlist,
    candidatesByKind: result.candidatesByKind,
    plannedByKind: result.plannedByKind,
    skippedByReason: result.skippedByReason,
    sent: result.sent.length,
    failed: result.failed.length,
    recordFailed: result.recordFailed,
  };
}

export async function runNudgeCommand(args: NudgeCommandArgs, deps: NudgeCommandDeps): Promise<number> {
  let locked = false;
  try {
    locked = await deps.tryLock();
    if (!locked) {
      deps.log("Another nudge run is already in progress; exiting without sending.");
      return 0;
    }

    const result = await deps.runNudges({
      dryRun: !args.send,
      maxSends: args.maxSends,
      allowlist: args.allowlist,
    });

    if (args.json) {
      deps.log(JSON.stringify(result, null, 2));
    } else {
      deps.log(
        `${result.dryRun ? "DRY RUN" : "LIVE RUN"} · sending ${result.sendingEnabled ? "enabled" : "disabled"} · ` +
          `Slack ${result.slackConfigured ? "configured" : "NOT configured"} · ` +
          `deadline ${result.deadlineIso ?? "unknown"} (${result.daysLeft ?? "?"} days left) · cap ${result.maxSends}` +
          (result.allowlist ? ` · allowlist ${result.allowlist.join(",")}` : ""),
      );
      if (result.daysLeft !== null && result.daysLeft < 0) deps.log("Deadline passed: nothing is sent.");
      if (!result.dryRun) deps.log(`sent ${result.sent.length} · failed ${result.failed.length}`);
      for (const sample of result.samples) {
        deps.log(`--- ${sample.kind} / ${sample.variant} ---\n${sample.text}`);
      }
    }
    deps.log(JSON.stringify(summarizeNudgeRun(result)));

    if (result.recordFailed) {
      deps.error(
        "A DM was sent but its user_nudge row could not be written; the run stopped. Add the row by hand before running again.",
      );
    }
    return nudgeCommandExitCode(result);
  } catch (err) {
    deps.error(`Nudge run failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    return 1;
  } finally {
    if (locked) {
      try {
        await deps.unlock();
      } catch (err) {
        deps.error(`Failed to release the nudge lock: ${String(err)}`);
      }
    }
  }
}

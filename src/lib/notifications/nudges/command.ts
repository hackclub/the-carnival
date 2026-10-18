/**
 * The nudge command's logic, separated from process and database plumbing
 * so it can be unit tested (command.test.mjs). Entry point:
 * scripts/nudges/run.ts, bundled into the app image as scripts/nudges.js
 * and run daily by a Coolify scheduled task.
 *
 * Exit codes (Coolify marks non-zero runs as failed):
 *   0  done, dry run, deadline passed, or another run already holds the lock
 *   1  crash; a DM was sent but could not be recorded; or every send failed
 */
import type { NudgeRunOptions, NudgeRunResult } from "./run";

export type NudgeCommandArgs = {
  send: boolean;
  json: boolean;
  maxSends?: number;
  allowlist?: string[];
};

export function parseNudgeCommandArgs(argv: string[]): NudgeCommandArgs {
  const value = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const maxRaw = value("--max");
  const max = maxRaw !== undefined && maxRaw.trim() !== "" ? Number(maxRaw) : Number.NaN;
  const allowRaw = value("--allow");
  return {
    send: argv.includes("--send"),
    json: argv.includes("--json"),
    maxSends: Number.isFinite(max) && max >= 0 ? Math.floor(max) : undefined,
    allowlist: allowRaw ? allowRaw.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
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

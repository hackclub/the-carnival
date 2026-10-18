import { describe, expect, test } from "bun:test";

const { nudgeCommandExitCode, parseNudgeCommandArgs, runNudgeCommand } = await import("./command.ts");

function result(overrides = {}) {
  return {
    dryRun: false,
    sendingEnabled: true,
    slackConfigured: true,
    nowIso: "2026-10-18T16:00:00.000Z",
    deadlineIso: "2026-10-31T23:59:59.000Z",
    daysLeft: 13,
    maxSends: 200,
    allowlist: null,
    candidatesByKind: { hours_unsubmitted: 1, project_no_hours_7d: 0, connected_no_project: 0, never_connected: 0 },
    plannedByKind: { hours_unsubmitted: 1, project_no_hours_7d: 0, connected_no_project: 0, never_connected: 0 },
    skippedByReason: {},
    planned: [{ userId: "u1" }],
    sent: [{ userId: "u1" }],
    failed: [],
    recordFailed: false,
    samples: [],
    ...overrides,
  };
}

function deps(overrides = {}) {
  const calls = { runNudges: [], unlock: 0, logs: [], errors: [] };
  return {
    calls,
    deps: {
      tryLock: async () => true,
      unlock: async () => {
        calls.unlock += 1;
      },
      runNudges: async (options) => {
        calls.runNudges.push(options);
        return result();
      },
      log: (line) => calls.logs.push(line),
      error: (line) => calls.errors.push(line),
      ...overrides,
    },
  };
}

describe("parseNudgeCommandArgs", () => {
  test("defaults to a dry run", () => {
    expect(parseNudgeCommandArgs([])).toEqual({ send: false, json: false, maxSends: undefined, allowlist: undefined });
  });
  test("reads --send, --json, --max and --allow", () => {
    expect(parseNudgeCommandArgs(["--send", "--json", "--max", "25", "--allow", "U1, U2"])).toEqual({
      send: true,
      json: true,
      maxSends: 25,
      allowlist: ["U1", "U2"],
    });
  });
  test("ignores a missing or invalid --max", () => {
    expect(parseNudgeCommandArgs(["--max"]).maxSends).toBeUndefined();
    expect(parseNudgeCommandArgs(["--max", "abc"]).maxSends).toBeUndefined();
    expect(parseNudgeCommandArgs(["--max", "-3"]).maxSends).toBeUndefined();
  });
});

describe("nudgeCommandExitCode", () => {
  test("0 for a normal live run or a dry run", () => {
    expect(nudgeCommandExitCode(result())).toBe(0);
    expect(nudgeCommandExitCode(result({ dryRun: true, sent: [] }))).toBe(0);
  });
  test("1 when a sent DM could not be recorded", () => {
    expect(nudgeCommandExitCode(result({ recordFailed: true }))).toBe(1);
  });
  test("1 when everything due failed to send", () => {
    expect(nudgeCommandExitCode(result({ sent: [], failed: [{ userId: "u1" }] }))).toBe(1);
  });
  test("0 when nothing was due", () => {
    expect(nudgeCommandExitCode(result({ planned: [], sent: [], failed: [] }))).toBe(0);
  });
});

describe("runNudgeCommand", () => {
  test("exits 0 without running when another run holds the lock", async () => {
    const { calls, deps: d } = deps({ tryLock: async () => false });
    expect(await runNudgeCommand(parseNudgeCommandArgs(["--send"]), d)).toBe(0);
    expect(calls.runNudges).toHaveLength(0);
    expect(calls.unlock).toBe(0);
    expect(calls.logs[0]).toContain("already in progress");
  });

  test("passes --send/--max/--allow through, logs a JSON summary, and unlocks", async () => {
    const { calls, deps: d } = deps();
    const code = await runNudgeCommand(parseNudgeCommandArgs(["--send", "--max", "10", "--allow", "U1"]), d);
    expect(code).toBe(0);
    expect(calls.runNudges[0]).toEqual({ dryRun: false, maxSends: 10, allowlist: ["U1"] });
    const summary = JSON.parse(calls.logs.at(-1));
    expect(summary).toMatchObject({ event: "nudge_run", sent: 1, failed: 0, recordFailed: false });
    expect(calls.unlock).toBe(1);
  });

  test("without --send it is a dry run", async () => {
    const { calls, deps: d } = deps();
    await runNudgeCommand(parseNudgeCommandArgs([]), d);
    expect(calls.runNudges[0].dryRun).toBe(true);
  });

  test("exits 1, reports, and still unlocks when the record write failed", async () => {
    const { calls, deps: d } = deps({ runNudges: async () => result({ recordFailed: true }) });
    expect(await runNudgeCommand(parseNudgeCommandArgs(["--send"]), d)).toBe(1);
    expect(calls.errors.join("\n")).toContain("could not be written");
    expect(calls.unlock).toBe(1);
  });

  test("exits 1 and unlocks when the run throws", async () => {
    const { calls, deps: d } = deps({
      runNudges: async () => {
        throw new Error("db down");
      },
    });
    expect(await runNudgeCommand(parseNudgeCommandArgs(["--send"]), d)).toBe(1);
    expect(calls.errors[0]).toContain("db down");
    expect(calls.unlock).toBe(1);
  });
});

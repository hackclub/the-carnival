import { describe, expect, test } from "bun:test";

const { runOutreachLoop } = await import("./outreach-loop.ts");

function store(rows) {
  const delivered = [];
  let heartbeats = 0;
  const deps = {
    nextPending: async () => rows.find((r) => r.status === "pending") ?? null,
    deliver: async (r) => {
      delivered.push(r.id);
      return r.slackId === "BAD" ? { ok: false, reason: "slack_error" } : { ok: true };
    },
    markSent: async (r) => {
      rows.find((x) => x.id === r.id).status = "sent";
    },
    markFailed: async (r, reason) => {
      Object.assign(rows.find((x) => x.id === r.id), { status: "failed", reason });
    },
    heartbeat: async () => {
      heartbeats += 1;
    },
  };
  return { deps, delivered, heartbeats: () => heartbeats };
}

const row = (id, status, slackId = `U${id}`) => ({ id, status, slackId, userId: null, name: null, email: null });

describe("runOutreachLoop", () => {
  test("delivers every pending recipient once and records each result", async () => {
    const rows = [row("1", "pending"), row("2", "pending", "BAD"), row("3", "pending")];
    const s = store(rows);
    expect(await runOutreachLoop(s.deps)).toEqual({ sent: 2, failed: 1 });
    expect(rows.map((r) => r.status)).toEqual(["sent", "failed", "sent"]);
    expect(rows[1].reason).toBe("slack_error");
    expect(s.heartbeats()).toBe(3);
  });

  test("resume only touches recipients still pending", async () => {
    const rows = [row("1", "sent"), row("2", "skipped"), row("3", "failed"), row("4", "pending"), row("5", "pending")];
    const s = store(rows);
    await runOutreachLoop(s.deps);
    expect(s.delivered).toEqual(["4", "5"]);
    expect(rows.map((r) => r.status)).toEqual(["sent", "skipped", "failed", "sent", "sent"]);
  });

  test("nothing pending means nothing is sent", async () => {
    const s = store([row("1", "sent")]);
    expect(await runOutreachLoop(s.deps)).toEqual({ sent: 0, failed: 0 });
    expect(s.delivered).toEqual([]);
  });

  test("a row that never leaves pending throws instead of looping forever", async () => {
    const rows = [row("1", "pending")];
    const s = store(rows);
    s.deps.markSent = async () => {};
    await expect(runOutreachLoop(s.deps)).rejects.toThrow("still pending");
  });
});

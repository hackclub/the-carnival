import { describe, expect, test } from "bun:test";

const {
  assignBatches,
  batchCount,
  decideRecipient,
  isNudgedWithin,
  recentWindowCutoff,
  isOutreachSendStale,
  mergeRecipients,
  parseSlackIdList,
  renderOutreachMessage,
} = await import("./outreach-shared.ts");

describe("parseSlackIdList", () => {
  test("accepts IDs separated by commas, spaces and new lines, and mentions", () => {
    expect(parseSlackIdList("U0123ABCD, W0999ZZZZ\n<@U0AAAAAAA> <@U0BBBBBBB|ada> @U0CCCCCCC").ids).toEqual([
      "U0123ABCD",
      "W0999ZZZZ",
      "U0AAAAAAA",
      "U0BBBBBBB",
      "U0CCCCCCC",
    ]);
  });

  test("uppercases, reports duplicates and junk separately", () => {
    const parsed = parseSlackIdList("u0123abcd U0123ABCD hello C0CHANNEL1 U12");
    expect(parsed.ids).toEqual(["U0123ABCD"]);
    expect(parsed.duplicates).toEqual(["U0123ABCD"]);
    expect(parsed.invalid).toEqual(["hello", "C0CHANNEL1", "U12"]);
  });

  test("empty input yields nothing", () => {
    expect(parseSlackIdList("  \n , ")).toEqual({ ids: [], invalid: [], duplicates: [] });
  });
});

describe("mergeRecipients", () => {
  const ada = { userId: "u1", slackId: "U0ADA0000", name: "Ada", email: "ada@x.test" };
  const grace = { userId: "u2", slackId: null, name: "Grace", email: "grace@x.test" };

  test("de-duplicates by user and keeps first occurrence", () => {
    expect(mergeRecipients([ada, grace], [ada]).map((r) => r.userId)).toEqual(["u1", "u2"]);
  });

  test("drops a Slack-ID-only entry when that Slack ID belongs to a listed user", () => {
    const slackOnlyAda = { userId: null, slackId: "u0ada0000", name: null, email: null };
    const stranger = { userId: null, slackId: "U0OUTSIDE", name: null, email: null };
    const merged = mergeRecipients([slackOnlyAda, stranger], [ada]);
    expect(merged.map((r) => r.userId ?? r.slackId)).toEqual(["U0OUTSIDE", "u1"]);
  });

  test("ignores entries with neither a user nor a Slack ID", () => {
    expect(mergeRecipients([{ userId: null, slackId: null, name: "x", email: null }])).toEqual([]);
  });
});

describe("decideRecipient", () => {
  const base = { channel: "slack", hasSlackId: true, hasEmail: true, isFrozen: false, isExcluded: false, recentlyNudged: false };

  test("pending when nothing blocks", () => {
    expect(decideRecipient(base)).toEqual({ status: "pending" });
  });

  test("exclusion wins over every other reason", () => {
    expect(decideRecipient({ ...base, isExcluded: true, isFrozen: true, hasSlackId: false })).toEqual({
      status: "skipped",
      reason: "excluded",
    });
  });

  test("frozen, recent, and missing contact details", () => {
    expect(decideRecipient({ ...base, isFrozen: true }).reason).toBe("frozen");
    expect(decideRecipient({ ...base, recentlyNudged: true }).reason).toBe("recently_nudged");
    expect(decideRecipient({ ...base, hasSlackId: false }).reason).toBe("no_slack_id");
    expect(decideRecipient({ ...base, channel: "email", hasEmail: false }).reason).toBe("no_email");
    expect(decideRecipient({ ...base, channel: "email", hasSlackId: false })).toEqual({ status: "pending" });
  });
});

describe("renderOutreachMessage / isOutreachSendStale", () => {
  test("replaces {firstName}", () => {
    expect(renderOutreachMessage("Hi {firstName}!", { name: "Ada Lovelace" })).toBe("Hi Ada!");
    expect(renderOutreachMessage("Hi {firstName}!", { name: null })).toBe("Hi there!");
  });

  test("stale only after 30 minutes without a heartbeat", () => {
    const now = new Date("2026-10-18T12:00:00.000Z");
    expect(isOutreachSendStale("2026-10-18T11:45:00.000Z", now)).toBe(false);
    expect(isOutreachSendStale("2026-10-18T11:29:00.000Z", now)).toBe(true);
    expect(isOutreachSendStale("nope", now)).toBe(false);
  });
});

describe("recentWindowCutoff", () => {
  const now = new Date("2026-10-19T15:30:00.000Z");

  test("today starts at midnight UTC", () => {
    expect(recentWindowCutoff("today", now).toISOString()).toBe("2026-10-19T00:00:00.000Z");
  });

  test("day windows count back from now", () => {
    expect(recentWindowCutoff("3d", now).toISOString()).toBe("2026-10-16T15:30:00.000Z");
    expect(recentWindowCutoff("7d", now).toISOString()).toBe("2026-10-12T15:30:00.000Z");
  });

  test("off never counts anyone as recent", () => {
    expect(recentWindowCutoff("off", now)).toBeNull();
    expect(isNudgedWithin("2026-10-19T15:00:00.000Z", null)).toBe(false);
  });

  test("a nudge at or after the cutoff is recent", () => {
    const cutoff = recentWindowCutoff("today", now);
    expect(isNudgedWithin("2026-10-19T00:00:00.000Z", cutoff)).toBe(true);
    expect(isNudgedWithin("2026-10-18T23:59:59.000Z", cutoff)).toBe(false);
    expect(isNudgedWithin(null, cutoff)).toBe(false);
    expect(isNudgedWithin("garbage", cutoff)).toBe(false);
  });
});

describe("assignBatches", () => {
  test("fills batches in order with people who will be messaged", () => {
    expect(assignBatches(["pending", "pending", "pending", "pending", "pending"], 2)).toEqual([1, 1, 2, 2, 3]);
  });

  test("skipped people don't take a slot", () => {
    expect(assignBatches(["skipped", "pending", "skipped", "pending", "pending"], 2)).toEqual([1, 1, 1, 1, 2]);
  });

  test("600 people in batches of 300 is two batches", () => {
    const batches = assignBatches(Array(600).fill("pending"), 300);
    expect(batches[299]).toBe(1);
    expect(batches[300]).toBe(2);
    expect(Math.max(...batches)).toBe(2);
    expect(batchCount(600, 300)).toBe(2);
    expect(batchCount(601, 300)).toBe(3);
    expect(batchCount(0, 300)).toBe(0);
  });
});

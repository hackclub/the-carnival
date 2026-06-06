import { describe, expect, test } from "bun:test";

const {
  buildHackatimeDevlogReviewUrls,
} = await import("./constants.ts");

describe("Hackatime review URL builders", () => {
  test("builds Billy and Joe.fraud links with the exact devlog timestamp range", () => {
    expect(
      buildHackatimeDevlogReviewUrls({
        hackatimeId: "user 123",
        startedAt: "2026-04-11T01:00:00.000Z",
        endedAt: "2026-04-11T02:30:00.000Z",
      }),
    ).toEqual({
      billyUrl:
        "https://billy.3kh0.net/?u=user%20123&d=2026-04-11T01%3A00%3A00.000Z-2026-04-11T02%3A30%3A00.000Z",
      joeFraudUrl:
        "https://joe.fraud.hackclub.com/billy?u=user%20123&d=2026-04-11T01%3A00%3A00.000Z-2026-04-11T02%3A30%3A00.000Z",
    });
  });

  test("does not build devlog links without a valid user and time window", () => {
    expect(
      buildHackatimeDevlogReviewUrls({
        hackatimeId: "",
        startedAt: "2026-04-11T01:00:00.000Z",
        endedAt: "2026-04-11T02:30:00.000Z",
      }),
    ).toBeNull();

    expect(
      buildHackatimeDevlogReviewUrls({
        hackatimeId: "user-123",
        startedAt: "2026-04-11T02:30:00.000Z",
        endedAt: "2026-04-11T01:00:00.000Z",
      }),
    ).toBeNull();
  });
});

import { describe, expect, test } from "bun:test";

const { deriveHackatimeConnectionStatus, hackatimeConnectUrl } = await import(
  "./hackatime-connection.ts"
);

describe("deriveHackatimeConnectionStatus", () => {
  test("a stored token means connected regardless of connected-at", () => {
    expect(deriveHackatimeConnectionStatus({ hasToken: true, connectedAt: null })).toBe("connected");
    expect(
      deriveHackatimeConnectionStatus({ hasToken: true, connectedAt: new Date("2026-03-01") }),
    ).toBe("connected");
  });

  test("connected-at without a token means the token was revoked and dropped", () => {
    expect(
      deriveHackatimeConnectionStatus({ hasToken: false, connectedAt: "2026-03-01T00:00:00.000Z" }),
    ).toBe("needs_reconnect");
  });

  test("nothing stored means never connected (or deliberately disconnected)", () => {
    expect(deriveHackatimeConnectionStatus({ hasToken: false, connectedAt: null })).toBe(
      "not_connected",
    );
    expect(deriveHackatimeConnectionStatus({ hasToken: false, connectedAt: undefined })).toBe(
      "not_connected",
    );
  });
});

describe("hackatimeConnectUrl", () => {
  test("encodes the return path", () => {
    expect(hackatimeConnectUrl("/projects/abc?tab=hackatime")).toBe(
      "/api/hackatime/oauth/start?returnTo=%2Fprojects%2Fabc%3Ftab%3Dhackatime",
    );
  });

  test("refuses off-site return targets", () => {
    expect(hackatimeConnectUrl("https://evil.example")).toBe(
      "/api/hackatime/oauth/start?returnTo=%2Fprojects",
    );
  });
});

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const calls = [];
mock.module("@/lib/notifications/nudges/run", () => ({
  nudgeMaxPerRunFromEnv: () => 200,
  runNudges: async (options) => {
    calls.push(options);
    return { dryRun: options.dryRun, planned: [], sent: [], failed: [] };
  },
}));

const { GET, POST } = await import("./route.ts");

const SECRET = "test-cron-secret";

function request(method, { auth, query = "" } = {}) {
  return new Request(`http://localhost/api/cron/nudges${query}`, {
    method,
    headers: auth ? { authorization: auth } : {},
  });
}

describe("/api/cron/nudges", () => {
  const originalSecret = process.env.CRON_SECRET;
  beforeEach(() => {
    calls.length = 0;
    process.env.CRON_SECRET = SECRET;
  });
  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  test("refuses with 503 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(request("POST", { auth: `Bearer ${SECRET}` }));
    expect(res.status).toBe(503);
    expect(calls).toHaveLength(0);
  });

  test("rejects a missing or wrong bearer token", async () => {
    expect((await POST(request("POST"))).status).toBe(401);
    expect((await POST(request("POST", { auth: "Bearer nope" }))).status).toBe(401);
    expect((await POST(request("POST", { auth: `Bearer ${SECRET}x` }))).status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  test("POST with the secret runs live; ?dryRun=1 and GET force a dry run", async () => {
    const live = await POST(request("POST", { auth: `Bearer ${SECRET}` }));
    expect(live.status).toBe(200);
    expect(calls[0]).toEqual({ dryRun: false, maxSends: undefined });

    await POST(request("POST", { auth: `Bearer ${SECRET}`, query: "?dryRun=1" }));
    expect(calls[1].dryRun).toBe(true);

    const get = await GET(request("GET", { auth: `Bearer ${SECRET}` }));
    expect(get.status).toBe(200);
    expect(calls[2].dryRun).toBe(true);
    expect(await get.json()).toEqual({ dryRun: true, planned: [], sent: [], failed: [] });
  });

  test("?max lowers the cap but can never raise it above the env cap", async () => {
    await POST(request("POST", { auth: `Bearer ${SECRET}`, query: "?max=25" }));
    expect(calls[0].maxSends).toBe(25);
    await POST(request("POST", { auth: `Bearer ${SECRET}`, query: "?max=5000" }));
    expect(calls[1].maxSends).toBe(200);
    await POST(request("POST", { auth: `Bearer ${SECRET}`, query: "?max=abc" }));
    expect(calls[2].maxSends).toBeUndefined();
  });
});

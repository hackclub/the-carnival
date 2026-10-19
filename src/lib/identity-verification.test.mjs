import { afterEach, describe, expect, mock, test } from "bun:test";

const dbState = {
  userRow: null,
  updateCalls: [],
};

mock.module("@/db", () => ({
  db: {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit: async () => (dbState.userRow ? [dbState.userRow] : []),
              };
            },
          };
        },
      };
    },
    update() {
      return {
        set(values) {
          return {
            where: async () => {
              dbState.updateCalls.push(values);
              return [];
            },
          };
        },
      };
    },
  },
}));

const { getIdentitySubmissionBlock } = await import("./identity-verification-shared.ts");
const { getIdentityVerificationStatus } = await import("./identity-verification.ts");

const originalFetch = globalThis.fetch;
const fetchCalls = [];

function mockIdentityResponse(response) {
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url: String(url), init });
    if (response instanceof Error) throw response;
    return response;
  };
}

function identityMe(verificationStatus) {
  return Response.json({ identity: { id: "ident!abc", verification_status: verificationStatus } });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  fetchCalls.length = 0;
  dbState.userRow = null;
  dbState.updateCalls = [];
});

describe("getIdentitySubmissionBlock", () => {
  test("lets verified creators submit", () => {
    expect(getIdentitySubmissionBlock("verified")).toBeNull();
  });

  test("tells ineligible creators they can't submit", () => {
    const block = getIdentitySubmissionBlock("ineligible");
    expect(block.message).toContain("not eligible");
    expect(block.showVerifyLink).toBe(false);
  });

  test("tells pending creators to wait for a decision", () => {
    const block = getIdentitySubmissionBlock("pending");
    expect(block.message).toContain("once you get a decision");
    expect(block.showVerifyLink).toBe(false);
  });

  test("sends creators who haven't started to verification", () => {
    for (const status of ["needs_submission", null, undefined]) {
      const block = getIdentitySubmissionBlock(status);
      expect(block.message).toContain("complete identity verification");
      expect(block.message).toContain("https://auth.hackclub.com");
      expect(block.showVerifyLink).toBe(true);
    }
  });
});

describe("getIdentityVerificationStatus", () => {
  test("trusts a stored verified status without calling Hack Club Auth", async () => {
    dbState.userRow = { status: "verified", token: "tok" };
    mockIdentityResponse(identityMe("needs_submission"));

    expect(await getIdentityVerificationStatus("user-1")).toBe("verified");
    expect(fetchCalls).toHaveLength(0);
  });

  test("re-checks a stale status live and saves it", async () => {
    dbState.userRow = { status: "needs_submission", token: "tok" };
    mockIdentityResponse(identityMe("verified"));

    expect(await getIdentityVerificationStatus("user-1")).toBe("verified");
    expect(fetchCalls[0].url).toEndWith("/api/v1/me");
    expect(fetchCalls[0].init.headers.Authorization).toBe("Bearer tok");
    expect(dbState.updateCalls).toHaveLength(1);
    expect(dbState.updateCalls[0].verificationStatus).toBe("verified");
  });

  test("does not write when the live status is unchanged", async () => {
    dbState.userRow = { status: "pending", token: "tok" };
    mockIdentityResponse(identityMe("pending"));

    expect(await getIdentityVerificationStatus("user-1")).toBe("pending");
    expect(dbState.updateCalls).toHaveLength(0);
  });

  test("falls back to the stored status when the live check fails", async () => {
    dbState.userRow = { status: "needs_submission", token: "expired" };

    mockIdentityResponse(new Response("unauthorized", { status: 401 }));
    expect(await getIdentityVerificationStatus("user-1")).toBe("needs_submission");

    mockIdentityResponse(new Error("network down"));
    expect(await getIdentityVerificationStatus("user-1")).toBe("needs_submission");

    mockIdentityResponse(Response.json({ identity: [] }));
    expect(await getIdentityVerificationStatus("user-1")).toBe("needs_submission");

    expect(dbState.updateCalls).toHaveLength(0);
  });

  test("skips the live check without a stored token", async () => {
    dbState.userRow = { status: null, token: null };
    mockIdentityResponse(identityMe("verified"));

    expect(await getIdentityVerificationStatus("user-1")).toBeNull();
    expect(fetchCalls).toHaveLength(0);
  });

  test("returns null for an unknown user", async () => {
    expect(await getIdentityVerificationStatus("missing")).toBeNull();
  });
});

import { afterEach, describe, expect, mock, test } from "bun:test";

const dbState = { userRow: null };

mock.module("@/db", () => ({
  db: {
    select() {
      return {
        from() {
          return {
            where() {
              return { limit: async () => (dbState.userRow ? [dbState.userRow] : []) };
            },
          };
        },
      };
    },
  },
}));

const { fetchIdentityGrantProfile, loadCreatorAddress } = await import("./grant.ts");

const realFetch = globalThis.fetch;
const stubFetch = (status, body) => {
  globalThis.fetch = mock(async () => new Response(JSON.stringify(body), { status }));
};

const STORED = {
  addressLine1: null,
  addressLine2: "Stale Apt 9",
  city: "Storedville",
  stateProvince: null,
  country: "US",
  zipPostalCode: null,
};

const LIVE_ME = {
  identity: {
    first_name: "Orpheus",
    last_name: "Dino",
    primary_email: "orpheus@example.test",
    birthday: "2008-04-01",
    addresses: [
      { line_1: "Old Rd", city: "Oldtown", country: "US", primary: false },
      {
        line_1: "15 Falls Rd",
        city: "Shelburne",
        state: "VT",
        postal_code: "05482",
        country: "US",
        primary: true,
      },
    ],
  },
};

afterEach(() => {
  globalThis.fetch = realFetch;
  dbState.userRow = null;
});

describe("fetchIdentityGrantProfile", () => {
  test("returns null without a token, without calling Identity", async () => {
    stubFetch(200, LIVE_ME);
    expect(await fetchIdentityGrantProfile(null)).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("returns null when Identity rejects the token", async () => {
    stubFetch(401, { error: "invalid_token" });
    expect(await fetchIdentityGrantProfile("revoked")).toBeNull();
  });

  test("parses name, email, birthday and the primary address from a live answer", async () => {
    stubFetch(200, LIVE_ME);
    expect(await fetchIdentityGrantProfile("good")).toEqual({
      name: "Orpheus Dino",
      email: "orpheus@example.test",
      slackId: null,
      birthday: "2008-04-01",
      addressLine1: "15 Falls Rd",
      addressLine2: null,
      city: "Shelburne",
      stateProvince: "VT",
      country: "US",
      zipPostalCode: "05482",
    });
  });
});

describe("loadCreatorAddress", () => {
  test("uses the live address whole when Identity answers", async () => {
    dbState.userRow = { identityToken: "good", ...STORED };
    stubFetch(200, LIVE_ME);
    const resolved = await loadCreatorAddress("c1");
    expect(resolved.source).toBe("identity");
    expect(resolved.address.addressLine1).toBe("15 Falls Rd");
    expect(resolved.address.addressLine2).toBeNull();
    expect(resolved.missingRequired).toEqual([]);
  });

  test("falls back to the stored address when the token is rejected", async () => {
    dbState.userRow = { identityToken: "revoked", ...STORED };
    stubFetch(401, {});
    const resolved = await loadCreatorAddress("c1");
    expect(resolved.source).toBe("stored");
    expect(resolved.address).toEqual(STORED);
    expect(resolved.missingRequired).toEqual(["addressLine1"]);
  });

  test("reports none for a missing creator", async () => {
    expect((await loadCreatorAddress(null)).source).toBe("none");
    expect((await loadCreatorAddress("ghost")).source).toBe("none");
  });
});

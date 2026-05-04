import { beforeEach, describe, expect, mock, test } from "bun:test";

const state = {
  authUser: {
    id: "user-1",
    role: "user",
    isAdmin: false,
    isReviewer: false,
  },
  balance: 42,
};

mock.module("@/db", () => ({ db: {} }));
mock.module("@/lib/api-utils", () => ({
  getAuthUser: async () => state.authUser,
}));
mock.module("@/lib/wallet", () => ({
  getTokenBalance: async () => state.balance,
}));

const { GET } = await import("./route.ts");

describe("GET /api/wallet/balance", () => {
  beforeEach(() => {
    state.authUser = {
      id: "user-1",
      role: "user",
      isAdmin: false,
      isReviewer: false,
    };
    state.balance = 42;
  });

  test("requires authentication", async () => {
    state.authUser = null;
    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  test("returns balance with freshness timestamp", async () => {
    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.balance).toBe(42);
    expect(typeof json.fetchedAt).toBe("string");
    expect(Number.isNaN(new Date(json.fetchedAt).getTime())).toBe(false);
  });
});

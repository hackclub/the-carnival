import { beforeEach, describe, expect, mock, test } from "bun:test";

const state = {
  session: { user: { id: "user-1" } },
  disconnectCalls: [],
};

function resetState() {
  state.session = { user: { id: "user-1" } };
  state.disconnectCalls = [];
}

mock.module("@/lib/server-session", () => ({
  getServerSession: async () => state.session,
}));
mock.module("@/lib/hackatime", () => ({
  disconnectHackatimeForUser: async (userId) => {
    state.disconnectCalls.push(userId);
  },
}));

const { POST } = await import("./route.ts");

describe("POST /api/hackatime/disconnect", () => {
  beforeEach(() => {
    resetState();
  });

  test("rejects signed-out callers", async () => {
    state.session = null;

    const res = await POST();

    expect(res.status).toBe(401);
    expect(state.disconnectCalls).toEqual([]);
  });

  test("clears the signed-in user's Hackatime link", async () => {
    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(state.disconnectCalls).toEqual(["user-1"]);
  });
});

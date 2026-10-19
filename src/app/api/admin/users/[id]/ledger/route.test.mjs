import { beforeEach, describe, expect, mock, test } from "bun:test";

const state = {
  authUser: {
    id: "admin-1",
    role: "admin",
    isAdmin: true,
    isReviewer: true,
  },
  targetUser: {
    id: "user-1",
    role: "user",
  },
  balance: 25,
  ledgerInserts: [],
  auditCalls: [],
};

function resetState() {
  state.authUser = {
    id: "admin-1",
    role: "admin",
    isAdmin: true,
    isReviewer: true,
  };
  state.targetUser = {
    id: "user-1",
    role: "user",
  };
  state.balance = 25;
  state.ledgerInserts = [];
  state.auditCalls = [];
}

const db = {
  select() {
    const query = {
      from() {
        return query;
      },
      where() {
        return query;
      },
      limit: async () => (state.targetUser ? [state.targetUser] : []),
    };
    return query;
  },
  async transaction(cb) {
    const tx = {
      insert() {
        return {
          values: async (values) => {
            state.ledgerInserts.push(values);
            return [];
          },
        };
      },
    };
    return cb(tx);
  },
};

mock.module("@/db", () => ({ db }));
mock.module("@/lib/api-utils", () => ({
  getAuthUser: async () => state.authUser,
}));
mock.module("@/lib/wallet", () => ({
  getTokenBalance: async () => state.balance,
  getLedgerForUser: async () => [],
  hasIssuedTokensForProjectGrant: async () => false,
}));
mock.module("@/lib/admin-audit", () => ({
  appendAdminAudit: async (input) => {
    state.auditCalls.push(input);
  },
}));

const { POST } = await import("./route.ts");

const VALID_ISSUE_BODY = {
  type: "issue",
  amount: 10,
  reason: "Manual top-up after a support ticket",
  confirmation: "CONFIRM_LEDGER_ADJUSTMENT",
};

async function postAdjustment(targetUserId, body) {
  const req = new Request(`http://localhost/api/admin/users/${targetUserId}/ledger`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await POST(req, { params: Promise.resolve({ id: targetUserId }) });
  const json = await res.json();
  return { res, json };
}

describe("POST /api/admin/users/[id]/ledger", () => {
  beforeEach(() => {
    resetState();
  });

  test("rejects adjustments by non-admin users", async () => {
    state.authUser = { id: "reviewer-1", role: "reviewer", isAdmin: false, isReviewer: true };

    const { res, json } = await postAdjustment("user-1", VALID_ISSUE_BODY);

    expect(res.status).toBe(403);
    expect(json.error).toBe("Forbidden");
    expect(state.ledgerInserts).toEqual([]);
  });

  test("rejects admin attempts to adjust their own token balance", async () => {
    const { res, json } = await postAdjustment("admin-1", VALID_ISSUE_BODY);

    expect(res.status).toBe(400);
    expect(json.error).toBe("Cannot adjust your own token balance");
    expect(state.ledgerInserts).toEqual([]);
    expect(state.auditCalls).toEqual([]);
  });

  test("issues tokens to another user and audits the adjustment", async () => {
    const { res, json } = await postAdjustment("user-1", VALID_ISSUE_BODY);

    expect(res.status).toBe(201);
    expect(json.balanceBefore).toBe(25);
    expect(json.balanceAfter).toBe(35);
    expect(state.ledgerInserts).toHaveLength(1);
    expect(state.ledgerInserts[0]).toMatchObject({
      kind: "issue",
      tokens: 10,
      issuedToUserId: "user-1",
      byUserId: "admin-1",
    });
    expect(state.auditCalls).toHaveLength(1);
    expect(state.auditCalls[0]).toMatchObject({
      actorId: "admin-1",
      action: "ledger_adjustment_created",
      targetUserId: "user-1",
    });
  });
});

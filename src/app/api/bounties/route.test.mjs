import { beforeEach, describe, expect, mock, test } from "bun:test";

const state = {
  authUser: {
    id: "user-1",
    role: "user",
    isAdmin: false,
    isReviewer: false,
  },
  freezeState: {
    isFrozen: false,
    frozenReason: null,
  },
  insertedBountyValues: null,
};

function resetState() {
  state.authUser = {
    id: "user-1",
    role: "user",
    isAdmin: false,
    isReviewer: false,
  };
  state.freezeState = {
    isFrozen: false,
    frozenReason: null,
  };
  state.insertedBountyValues = null;
}

const db = {
  insert() {
    return {
      values: async (values) => {
        state.insertedBountyValues = values;
        return [values];
      },
    };
  },
};

mock.module("@/db", () => ({ db }));
mock.module("@/lib/api-utils", () => ({
  getAuthUser: async () => state.authUser,
  parseJsonBody: async (req) => req.json().catch(() => null),
  toCleanString: (value) => (typeof value === "string" ? value.trim() : ""),
  toPositiveInt: (value) => {
    if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
    if (typeof value === "string" && value.trim()) return Math.floor(Number(value));
    return NaN;
  },
  generateId: () => "bounty-1",
  timestamps: () => ({ createdAt: new Date(), updatedAt: new Date() }),
}));
mock.module("@/lib/frozen-account", () => ({
  getFrozenAccountState: async () => state.freezeState,
  getFrozenAccountMessage: () => "Frozen",
}));

const { POST } = await import("./route.ts");

const BASE_BODY = {
  name: "Build a terminal widget",
  description: "Make a delightful terminal widget.",
  prizeUsd: 40,
  previewImageUrl: "https://example.com/preview.png",
  requirements: "Must run in VS Code.",
  examples: "Try a status bar.",
  helpfulLinks: [{ label: "Docs", url: "https://example.com/docs" }],
};

async function createBounty(body = BASE_BODY) {
  const req = new Request("http://localhost/api/bounties", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await POST(req);
  const json = await res.json();
  return { res, json };
}

describe("POST /api/bounties", () => {
  beforeEach(() => {
    resetState();
  });

  test("normal users create pending bounty proposals", async () => {
    const { res, json } = await createBounty();

    expect(res.status).toBe(201);
    expect(json.status).toBe("pending");
    expect(state.insertedBountyValues.status).toBe("pending");
    expect(state.insertedBountyValues.createdById).toBe("user-1");
    expect(state.insertedBountyValues.reviewedById).toBeNull();
  });

  test("admins create approved official bounties", async () => {
    state.authUser = {
      id: "admin-1",
      role: "admin",
      isAdmin: true,
      isReviewer: true,
    };

    const { res, json } = await createBounty();

    expect(res.status).toBe(201);
    expect(json.status).toBe("approved");
    expect(state.insertedBountyValues.status).toBe("approved");
    expect(state.insertedBountyValues.createdById).toBe("admin-1");
    expect(state.insertedBountyValues.reviewedById).toBe("admin-1");
    expect(state.insertedBountyValues.reviewedAt).toBeInstanceOf(Date);
  });
});

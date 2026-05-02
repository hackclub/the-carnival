import { beforeEach, describe, expect, mock, test } from "bun:test";

const state = {
  authUser: {
    id: "user-1",
    role: "user",
    isAdmin: false,
    isReviewer: false,
  },
  existing: {
    id: "bounty-1",
    status: "pending",
  },
  updateSet: null,
};

function resetState() {
  state.authUser = {
    id: "user-1",
    role: "user",
    isAdmin: false,
    isReviewer: false,
  };
  state.existing = {
    id: "bounty-1",
    status: "pending",
  };
  state.updateSet = null;
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
      then(resolve) {
        return Promise.resolve(state.existing ? [state.existing] : []).then(resolve);
      },
    };
    return query;
  },
  update() {
    return {
      set(values) {
        state.updateSet = values;
        return {
          where: async () => [],
        };
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
}));

const { PATCH } = await import("./route.ts");

async function patchBounty(body) {
  const req = new Request("http://localhost/api/bounties/bounty-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await PATCH(req, { params: Promise.resolve({ id: "bounty-1" }) });
  const json = await res.json();
  return { res, json };
}

describe("PATCH /api/bounties/[id]", () => {
  beforeEach(() => {
    resetState();
  });

  test("non-admins cannot approve bounty proposals", async () => {
    const { res, json } = await patchBounty({ status: "approved" });

    expect(res.status).toBe(403);
    expect(json.error).toBe("Forbidden");
    expect(state.updateSet).toBeNull();
  });

  test("admins can approve bounty proposals", async () => {
    state.authUser = {
      id: "admin-1",
      role: "admin",
      isAdmin: true,
      isReviewer: true,
    };

    const { res, json } = await patchBounty({ status: "approved" });

    expect(res.status).toBe(200);
    expect(json.status).toBe("approved");
    expect(state.updateSet.status).toBe("approved");
    expect(state.updateSet.reviewedById).toBe("admin-1");
    expect(state.updateSet.reviewedAt).toBeInstanceOf(Date);
    expect(state.updateSet.rejectionReason).toBeNull();
  });
});

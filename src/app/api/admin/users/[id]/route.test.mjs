import { beforeEach, describe, expect, mock, test } from "bun:test";

const state = {
  session: {
    user: {
      id: "admin-1",
      role: "admin",
    },
  },
  targetUser: {
    id: "user-1",
    name: "User One",
    email: "user@example.com",
    role: "user",
    isFrozen: false,
    frozenReason: null,
    frozenAt: null,
    frozenByUserId: null,
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
  },
  updateSet: null,
};

function resetState() {
  state.session = {
    user: {
      id: "admin-1",
      role: "admin",
    },
  };
  state.targetUser = {
    id: "user-1",
    name: "User One",
    email: "user@example.com",
    role: "user",
    isFrozen: false,
    frozenReason: null,
    frozenAt: null,
    frozenByUserId: null,
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
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
      limit: async () => (state.targetUser ? [state.targetUser] : []),
    };
    return query;
  },
  update() {
    return {
      set(values) {
        state.updateSet = values;
        return {
          where() {
            return {
              returning: async () => [
                {
                  ...state.targetUser,
                  role: values.role ?? state.targetUser.role,
                  updatedAt: values.updatedAt ?? state.targetUser.updatedAt,
                },
              ],
            };
          },
        };
      },
    };
  },
};

mock.module("@/db", () => ({ db }));
mock.module("@/lib/server-session", () => ({
  getServerSession: async () => state.session,
}));
mock.module("@/lib/admin-audit", () => ({
  appendAdminAudit: async () => {},
}));

const { PATCH } = await import("./route.ts");

async function patchUser(targetUserId, body) {
  const req = new Request(`http://localhost/api/admin/users/${targetUserId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await PATCH(req, { params: Promise.resolve({ id: targetUserId }) });
  const json = await res.json();
  return { res, json };
}

describe("PATCH /api/admin/users/[id]", () => {
  beforeEach(() => {
    resetState();
  });

  test("rejects role changes by non-admin users", async () => {
    state.session.user.role = "user";

    const { res, json } = await patchUser("user-1", { role: "admin" });

    expect(res.status).toBe(403);
    expect(json.error).toBe("Forbidden");
    expect(state.updateSet).toBeNull();
  });

  test("rejects admin attempts to change their own role", async () => {
    const { res, json } = await patchUser("admin-1", { role: "user" });

    expect(res.status).toBe(400);
    expect(json.error).toBe("Cannot update your own role or freeze state");
    expect(state.updateSet).toBeNull();
  });

  test("allows admins to change another user's role", async () => {
    const { res, json } = await patchUser("user-1", { role: "reviewer" });

    expect(res.status).toBe(200);
    expect(json.user.id).toBe("user-1");
    expect(json.user.role).toBe("reviewer");
    expect(state.updateSet.role).toBe("reviewer");
    expect(state.updateSet.updatedAt).toBeInstanceOf(Date);
  });
});

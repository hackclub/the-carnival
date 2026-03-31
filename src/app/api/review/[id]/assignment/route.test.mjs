import { beforeEach, describe, expect, mock, test } from "bun:test";

const state = {
  session: {
    user: {
      id: "reviewer-1",
      role: "reviewer",
    },
  },
  projectRow: {
    id: "project-1",
    status: "in-review",
  },
  insertedRows: [{ id: "assignment-1" }],
  removedRows: [{ id: "assignment-1" }],
  assignmentsRows: [
    {
      reviewerId: "reviewer-1",
      reviewerName: "Reviewer One",
      reviewerEmail: "reviewer@example.com",
      createdAt: new Date("2026-03-31T12:00:00.000Z"),
    },
  ],
  auditCalls: [],
};

function resetState() {
  state.session = {
    user: {
      id: "reviewer-1",
      role: "reviewer",
    },
  };
  state.projectRow = {
    id: "project-1",
    status: "in-review",
  };
  state.insertedRows = [{ id: "assignment-1" }];
  state.removedRows = [{ id: "assignment-1" }];
  state.assignmentsRows = [
    {
      reviewerId: "reviewer-1",
      reviewerName: "Reviewer One",
      reviewerEmail: "reviewer@example.com",
      createdAt: new Date("2026-03-31T12:00:00.000Z"),
    },
  ];
  state.auditCalls = [];
}

function buildTx() {
  return {
    select() {
      const query = {
        isAssignmentList: false,
        from() {
          return query;
        },
        leftJoin() {
          query.isAssignmentList = true;
          return query;
        },
        where() {
          return query;
        },
        limit: async () => (state.projectRow ? [state.projectRow] : []),
        orderBy: async () => (query.isAssignmentList ? state.assignmentsRows : []),
      };
      return query;
    },
    insert() {
      return {
        values() {
          return {
            onConflictDoNothing() {
              return {
                returning: async () => state.insertedRows,
              };
            },
          };
        },
      };
    },
    delete() {
      return {
        where() {
          return {
            returning: async () => state.removedRows,
          };
        },
      };
    },
  };
}

const db = {
  async transaction(cb) {
    return cb(buildTx());
  },
};

mock.module("@/db", () => ({ db }));
mock.module("@/lib/server-session", () => ({
  getServerSession: async () => state.session,
}));
mock.module("@/lib/review-audit", () => ({
  appendReviewAudit: async (input) => {
    state.auditCalls.push(input);
  },
}));

const { POST, DELETE } = await import("./route.ts");

async function assign() {
  const req = new Request("http://localhost/api/review/project-1/assignment", { method: "POST" });
  const res = await POST(req, { params: Promise.resolve({ id: "project-1" }) });
  const json = await res.json();
  return { res, json };
}

async function unassign() {
  const req = new Request("http://localhost/api/review/project-1/assignment", { method: "DELETE" });
  const res = await DELETE(req, { params: Promise.resolve({ id: "project-1" }) });
  const json = await res.json();
  return { res, json };
}

describe("assignment route", () => {
  beforeEach(() => {
    resetState();
  });

  test("POST assigns reviewer and returns assignment list", async () => {
    const { res, json } = await assign();

    expect(res.status).toBe(200);
    expect(json.assigned).toBe(true);
    expect(json.assignments.length).toBe(1);
    expect(state.auditCalls.length).toBe(1);
    expect(state.auditCalls[0].action).toBe("review_assignment_added");
  });

  test("POST supports non-exclusive no-op when reviewer is already assigned", async () => {
    state.insertedRows = [];

    const { res, json } = await assign();

    expect(res.status).toBe(200);
    expect(json.assigned).toBe(true);
    expect(json.assignments.length).toBe(1);
    expect(state.auditCalls.length).toBe(0);
  });

  test("DELETE unassigns reviewer and returns assignment list", async () => {
    state.assignmentsRows = [];

    const { res, json } = await unassign();

    expect(res.status).toBe(200);
    expect(json.assigned).toBe(false);
    expect(json.assignments).toEqual([]);
    expect(state.auditCalls.length).toBe(1);
    expect(state.auditCalls[0].action).toBe("review_assignment_removed");
  });

  test("returns 409 when project is no longer in review", async () => {
    state.projectRow.status = "shipped";

    const { res, json } = await assign();

    expect(res.status).toBe(409);
    expect(json.error).toContain("no longer in review");
    expect(state.auditCalls.length).toBe(0);
  });
});

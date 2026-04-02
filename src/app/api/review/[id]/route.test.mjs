import { beforeEach, describe, expect, mock, test } from "bun:test";
import { peerReview, reviewAuditLog } from "@/db/schema";

const state = {
  session: {
    user: {
      id: "reviewer-1",
      role: "reviewer",
      name: "Reviewer One",
      email: "reviewer@example.com",
    },
  },
  projectRow: {
    id: "project-1",
    name: "Project One",
    hackatimeProjectName: "project-one",
    status: "in-review",
    creatorId: null,
    hackatimeTotalSeconds: 4 * 3600,
  },
  updatedProjectRow: {
    id: "project-1",
    name: "Project One",
    creatorId: null,
    status: "shipped",
  },
  updateReturnsEmpty: false,
  insertedReviews: [],
  auditEntries: [],
  updateSets: [],
  assignmentDeleteCalls: 0,
};

function resetState() {
  state.session = {
    user: {
      id: "reviewer-1",
      role: "reviewer",
      name: "Reviewer One",
      email: "reviewer@example.com",
    },
  };
  state.projectRow = {
    id: "project-1",
    name: "Project One",
    hackatimeProjectName: "project-one",
    status: "in-review",
    creatorId: null,
    hackatimeTotalSeconds: 4 * 3600,
  };
  state.updatedProjectRow = {
    id: "project-1",
    name: "Project One",
    creatorId: null,
    status: "shipped",
  };
  state.updateReturnsEmpty = false;
  state.insertedReviews = [];
  state.auditEntries = [];
  state.updateSets = [];
  state.assignmentDeleteCalls = 0;
}

function buildTx() {
  return {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit: async () => (state.projectRow ? [state.projectRow] : []),
              };
            },
          };
        },
      };
    },
    insert(table) {
      if (table === peerReview) {
        return {
          values(values) {
            return {
              returning: async () => {
                state.insertedReviews.push(values);
                return [
                  {
                    id: values.id,
                    decision: values.decision,
                    reviewComment: values.reviewComment,
                    approvedHours: values.approvedHours,
                    hackatimeSnapshotSeconds: values.hackatimeSnapshotSeconds,
                    createdAt: values.createdAt,
                  },
                ];
              },
            };
          },
        };
      }

      if (table === reviewAuditLog) {
        return {
          values: async (values) => {
            state.auditEntries.push(values);
            return [values];
          },
        };
      }

      throw new Error("Unexpected insert table");
    },
    update() {
      return {
        set(values) {
          state.updateSets.push(values);
          return {
            where() {
              return {
                returning: async () => (state.updateReturnsEmpty ? [] : [state.updatedProjectRow]),
              };
            },
          };
        },
      };
    },
    delete() {
      return {
        where: async () => {
          state.assignmentDeleteCalls += 1;
          return [];
        },
      };
    },
  };
}

const db = {
  async transaction(cb) {
    const snapshot = {
      insertedReviewsLen: state.insertedReviews.length,
      auditEntriesLen: state.auditEntries.length,
      updateSetsLen: state.updateSets.length,
      assignmentDeleteCalls: state.assignmentDeleteCalls,
    };
    try {
      return await cb(buildTx());
    } catch (error) {
      state.insertedReviews.length = snapshot.insertedReviewsLen;
      state.auditEntries.length = snapshot.auditEntriesLen;
      state.updateSets.length = snapshot.updateSetsLen;
      state.assignmentDeleteCalls = snapshot.assignmentDeleteCalls;
      throw error;
    }
  },
  select() {
    return {
      from() {
        return {
          where() {
            return {
              limit: async () => [],
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
mock.module("@/lib/loops", () => ({
  sendReviewEmail: async () => undefined,
}));
mock.module("@/lib/slack", () => ({
  notifyReviewDM: async () => undefined,
}));

const { POST } = await import("./route.ts");

async function postReview(body) {
  const req = new Request("http://localhost/api/review/project-1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await POST(req, { params: Promise.resolve({ id: "project-1" }) });
  const json = await res.json();
  return { res, json };
}

function buildValidReviewJustification(overrides = {}) {
  return {
    hackatimeProjectName: state.projectRow.hackatimeProjectName,
    evidence: {
      hackatimeProjectReviewed: true,
      githubReviewed: true,
      sourceCodeReviewed: true,
      demoReviewed: true,
      manualTestPerformed: true,
    },
    reviewDateRange: {
      startDate: "2026-03-01",
      endDate: "2026-03-31",
    },
    deflationReasons: [],
    deflationNote: "",
    ...overrides,
  };
}

describe("POST /api/review/[id]", () => {
  beforeEach(() => {
    resetState();
  });

  test("rejects non-positive approved hours for approvals", async () => {
    const { res, json } = await postReview({
      decision: "approved",
      comment: "looks good",
      approvedHours: 0,
      reviewJustification: buildValidReviewJustification(),
    });

    expect(res.status).toBe(400);
    expect(json.error).toContain("greater than 0");
    expect(state.insertedReviews.length).toBe(0);
  });

  test("rejects non-0.5 increments for approvals", async () => {
    const { res, json } = await postReview({
      decision: "approved",
      comment: "looks good",
      approvedHours: 1.25,
      reviewJustification: buildValidReviewJustification(),
    });

    expect(res.status).toBe(400);
    expect(json.error).toContain("0.5-hour increments");
    expect(state.insertedReviews.length).toBe(0);
  });

  test("rejects approved hours above captured Hackatime snapshot", async () => {
    state.projectRow.hackatimeTotalSeconds = 2 * 3600;

    const { res, json } = await postReview({
      decision: "approved",
      comment: "approved",
      approvedHours: 2.5,
      reviewJustification: buildValidReviewJustification(),
    });

    expect(res.status).toBe(400);
    expect(json.error).toContain("captured Hackatime");
    expect(state.insertedReviews.length).toBe(0);
  });

  test("persists null approvedHours when rejecting", async () => {
    state.updatedProjectRow.status = "work-in-progress";

    const { res, json } = await postReview({
      decision: "rejected",
      comment: "needs revision",
      approvedHours: 9,
      reviewJustification: buildValidReviewJustification(),
    });

    expect(res.status).toBe(200);
    expect(json.review.approvedHours).toBeNull();
    expect(json.review.reviewJustification).toMatchObject({
      decision: "rejected",
      hackatimeProjectName: "project-one",
      reviewDateRange: { startDate: "2026-03-01", endDate: "2026-03-31" },
      deflation: { reduced: false, hoursReducedBy: 0, reasons: [], reasonRequired: false },
    });
    expect(state.insertedReviews.length).toBe(1);
    expect(state.insertedReviews[0].approvedHours).toBeNull();
    expect(state.updateSets[0].approvedHours).toBeNull();
  });

  test("requires reviewer confirmation payload for approvals", async () => {
    const { res, json } = await postReview({
      decision: "approved",
      comment: "approved",
      approvedHours: 3.5,
    });

    expect(res.status).toBe(400);
    expect(json.error).toContain("reviewer confirmation checklist");
    expect(state.insertedReviews.length).toBe(0);
  });

  test("requires deflation reasons when approved hours are at least 0.5 lower", async () => {
    const { res, json } = await postReview({
      decision: "approved",
      comment: "approved with reduction",
      approvedHours: 3,
      reviewJustification: buildValidReviewJustification(),
    });

    expect(res.status).toBe(400);
    expect(json.error).toContain("Select at least one deflation reason");
    expect(state.insertedReviews.length).toBe(0);
  });

  test("returns 409 on stale submit when status changes before update", async () => {
    state.updateReturnsEmpty = true;

    const { res, json } = await postReview({
      decision: "approved",
      comment: "approved",
      approvedHours: 1.5,
      reviewJustification: buildValidReviewJustification({
        deflationReasons: ["scopeCouldNotBeVerified"],
      }),
    });

    expect(res.status).toBe(409);
    expect(json.error).toContain("Refresh and try again");
    expect(state.insertedReviews.length).toBe(0);
    expect(state.auditEntries.length).toBe(0);
  });
});

import { beforeEach, describe, expect, mock, test } from "bun:test";
import { devlog, peerReview, peerReviewDevlogAssessment, reviewAuditLog } from "@/db/schema";

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
  devlogRows: [],
  insertedDevlogAssessments: [],
  operations: [],
  assignmentDeleteCalls: 0,
  hackatimeRangeFetchCalls: [],
  rangeFetchTotalSeconds: 4 * 3600,
};

const VALID_REVIEW_EVIDENCE = {
  hackatimeProjectReviewed: true,
  githubReviewed: true,
  sourceCodeReviewed: true,
  demoReviewed: true,
  manualTestPerformed: true,
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
  state.devlogRows = [];
  state.insertedDevlogAssessments = [];
  state.operations = [];
  state.assignmentDeleteCalls = 0;
  state.hackatimeRangeFetchCalls = [];
  state.rangeFetchTotalSeconds = 4 * 3600;
}

function buildTx() {
  return {
    select() {
      return {
        from(table) {
          if (table === devlog) {
            return {
              where: async () => state.devlogRows,
            };
          }
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
                state.operations.push("insert:peerReview");
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
            state.operations.push("insert:reviewAuditLog");
            state.auditEntries.push(values);
            return [values];
          },
        };
      }

      if (table === peerReviewDevlogAssessment) {
        return {
          values: async (values) => {
            state.operations.push("insert:peerReviewDevlogAssessment");
            state.insertedDevlogAssessments.push(...values);
            return values;
          },
        };
      }

      throw new Error("Unexpected insert table");
    },
    update() {
      return {
        set(values) {
          state.operations.push("update:project");
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
    delete(table) {
      return {
        where: async () => {
          if (table === peerReviewDevlogAssessment) {
            state.operations.push("delete:peerReviewDevlogAssessment");
          } else {
            state.operations.push("delete");
            state.assignmentDeleteCalls += 1;
          }
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
      insertedDevlogAssessmentsLen: state.insertedDevlogAssessments.length,
      operationsLen: state.operations.length,
      assignmentDeleteCalls: state.assignmentDeleteCalls,
    };
    try {
      return await cb(buildTx());
    } catch (error) {
      state.insertedReviews.length = snapshot.insertedReviewsLen;
      state.auditEntries.length = snapshot.auditEntriesLen;
      state.updateSets.length = snapshot.updateSetsLen;
      state.insertedDevlogAssessments.length = snapshot.insertedDevlogAssessmentsLen;
      state.operations.length = snapshot.operationsLen;
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
mock.module("@/lib/hackatime", () => ({
  refreshHackatimeProjectSnapshotForRange: async (...args) => {
    state.hackatimeRangeFetchCalls.push(args);
    return {
      hackatimeStartedAt: new Date(`${args[1].range.startDate}T00:00:00.000Z`),
      hackatimeStoppedAt: new Date(`${args[1].range.endDate}T23:59:59.999Z`),
      hackatimeTotalSeconds: state.rangeFetchTotalSeconds,
      hours: {
        hours: Math.floor(state.rangeFetchTotalSeconds / 3600),
        minutes: Math.floor(state.rangeFetchTotalSeconds / 60) % 60,
      },
    };
  },
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
    evidence: { ...VALID_REVIEW_EVIDENCE },
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
    expect(state.insertedReviews[0].reviewEvidenceChecklist).toEqual(VALID_REVIEW_EVIDENCE);
    expect(state.insertedReviews[0].reviewedHackatimeRangeStart.toISOString()).toBe(
      "2026-03-01T00:00:00.000Z",
    );
    expect(state.insertedReviews[0].reviewedHackatimeRangeEnd.toISOString()).toBe(
      "2026-03-31T23:59:59.999Z",
    );
    expect(state.insertedReviews[0].hourAdjustmentReasonMetadata).toMatchObject({
      decision: "rejected",
      hackatimeProjectName: "project-one",
      reduced: false,
      hoursReducedBy: 0,
      reasons: [],
      note: null,
      reasonRequired: false,
    });
    expect(state.updateSets[0].approvedHours).toBeNull();
  });

  test("persists structured peer_review justification fields for approvals", async () => {
    const { res, json } = await postReview({
      decision: "approved",
      comment: "approved with reduction",
      approvedHours: 3,
      reviewJustification: buildValidReviewJustification({
        deflationReasons: ["scopeCouldNotBeVerified", "other"],
        deflationNote: "Scope verification was incomplete.",
      }),
    });

    expect(res.status).toBe(200);
    expect(state.insertedReviews.length).toBe(1);
    expect(state.insertedReviews[0].approvedHours).toBe(3);
    expect(state.insertedReviews[0].reviewEvidenceChecklist).toEqual(VALID_REVIEW_EVIDENCE);
    expect(state.insertedReviews[0].reviewedHackatimeRangeStart.toISOString()).toBe(
      "2026-03-01T00:00:00.000Z",
    );
    expect(state.insertedReviews[0].reviewedHackatimeRangeEnd.toISOString()).toBe(
      "2026-03-31T23:59:59.999Z",
    );
    expect(state.insertedReviews[0].hourAdjustmentReasonMetadata).toMatchObject({
      decision: "approved",
      hackatimeProjectName: "project-one",
      reduced: true,
      hoursReducedBy: 1,
      reasons: ["scopeCouldNotBeVerified", "other"],
      note: "Scope verification was incomplete.",
      reasonRequired: true,
    });
    expect(json.review.reviewJustification).toMatchObject({
      decision: "approved",
      deflation: {
        reduced: true,
        hoursReducedBy: 1,
        reasons: ["scopeCouldNotBeVerified", "other"],
        reasonRequired: true,
      },
    });
  });

  test("honors manually entered approved hours when devlog assessments are present", async () => {
    state.devlogRows = [
      { id: "devlog-1", durationSeconds: 60 * 60 },
      { id: "devlog-2", durationSeconds: 60 * 60 },
    ];

    const { res, json } = await postReview({
      decision: "approved",
      comment: "approved manual hours",
      approvedHours: 3.5,
      devlogAssessments: [
        { devlogId: "devlog-1", decision: "accepted" },
        { devlogId: "devlog-2", decision: "accepted" },
      ],
      reviewJustification: buildValidReviewJustification({
        deflationReasons: ["scopeCouldNotBeVerified"],
      }),
    });

    expect(res.status).toBe(200);
    expect(json.review.approvedHours).toBe(3.5);
    expect(state.insertedReviews[0].approvedHours).toBe(3.5);
    expect(state.updateSets[0].approvedHours).toBe(3.5);
    expect(state.insertedDevlogAssessments.length).toBe(2);
    expect(state.operations.indexOf("insert:peerReview")).toBeLessThan(
      state.operations.indexOf("insert:peerReviewDevlogAssessment"),
    );
  });

  test("accepts normalized deflation payloads for compatibility", async () => {
    const { res, json } = await postReview({
      decision: "approved",
      comment: "approved with reduction",
      approvedHours: 3,
      reviewJustification: {
        decision: "approved",
        hackatimeProjectName: state.projectRow.hackatimeProjectName,
        evidence: { ...VALID_REVIEW_EVIDENCE },
        reviewDateRange: {
          startDate: "2026-03-01",
          endDate: "2026-03-31",
        },
        deflation: {
          reduced: true,
          hoursReducedBy: 1,
          reasons: ["scopeCouldNotBeVerified", "other"],
          note: "Scope verification was incomplete.",
          reasonRequired: true,
        },
      },
    });

    expect(res.status).toBe(200);
    expect(state.insertedReviews.length).toBe(1);
    expect(state.insertedReviews[0].hourAdjustmentReasonMetadata).toMatchObject({
      decision: "approved",
      hackatimeProjectName: "project-one",
      reduced: true,
      hoursReducedBy: 1,
      reasons: ["scopeCouldNotBeVerified", "other"],
      note: "Scope verification was incomplete.",
      reasonRequired: true,
    });
    expect(json.review.reviewJustification).toMatchObject({
      decision: "approved",
      deflation: {
        reduced: true,
        hoursReducedBy: 1,
        reasons: ["scopeCouldNotBeVerified", "other"],
        note: "Scope verification was incomplete.",
        reasonRequired: true,
      },
    });
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

  test("allows rejections without reviewer confirmation payload", async () => {
    state.updatedProjectRow.status = "work-in-progress";

    const { res, json } = await postReview({
      decision: "rejected",
      comment: "needs revision",
    });

    expect(res.status).toBe(200);
    expect(json.review.reviewJustification).toBeNull();
    expect(state.insertedReviews.length).toBe(1);
    expect(state.insertedReviews[0].reviewEvidenceChecklist).toEqual({});
    expect(state.insertedReviews[0].reviewedHackatimeRangeStart).toBeNull();
    expect(state.insertedReviews[0].reviewedHackatimeRangeEnd).toBeNull();
    expect(state.insertedReviews[0].hourAdjustmentReasonMetadata).toEqual({});
  });

  test("rejects rejection payloads with incomplete evidence checklist", async () => {
    const { res, json } = await postReview({
      decision: "rejected",
      comment: "needs revision",
      reviewJustification: buildValidReviewJustification({
        evidence: { ...VALID_REVIEW_EVIDENCE, demoReviewed: false },
      }),
    });

    expect(res.status).toBe(400);
    expect(json.error).toContain("Missing: Demo/video reviewed");
    expect(state.insertedReviews.length).toBe(0);
  });

  test("rejects rejection payloads with invalid date ranges", async () => {
    const { res, json } = await postReview({
      decision: "rejected",
      comment: "needs revision",
      reviewJustification: buildValidReviewJustification({
        reviewDateRange: { startDate: "2026-03-31", endDate: "2026-03-01" },
      }),
    });

    expect(res.status).toBe(400);
    expect(json.error).toContain("start date must be before or equal to end date");
    expect(state.insertedReviews.length).toBe(0);
  });

  test("rejects rejection payloads with mismatched project names", async () => {
    const { res, json } = await postReview({
      decision: "rejected",
      comment: "needs revision",
      reviewJustification: buildValidReviewJustification({
        hackatimeProjectName: "different-project",
      }),
    });

    expect(res.status).toBe(400);
    expect(json.error).toContain("exact project name reviewed");
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

  test("rejects non-admin attempts to override the considered Hackatime range", async () => {
    const { res, json } = await postReview({
      decision: "approved",
      comment: "approved",
      approvedHours: 3,
      consideredHackatimeRange: {
        startDate: "2026-03-10",
        endDate: "2026-03-20",
      },
      reviewJustification: buildValidReviewJustification({
        deflationReasons: ["scopeCouldNotBeVerified"],
      }),
    });

    expect(res.status).toBe(403);
    expect(json.error).toContain("Only admins");
    expect(state.hackatimeRangeFetchCalls).toEqual([]);
    expect(state.insertedReviews.length).toBe(0);
  });

  test("admin approvals can override and refresh the considered Hackatime range", async () => {
    state.session.user.role = "admin";
    state.projectRow.creatorId = "project-creator-1";
    state.updatedProjectRow.creatorId = "project-creator-1";
    state.updatedProjectRow.approvedHours = 3;
    state.updatedProjectRow.hackatimeStartedAt = new Date("2026-03-10T00:00:00.000Z");
    state.updatedProjectRow.hackatimeStoppedAt = new Date("2026-03-20T23:59:59.999Z");
    state.updatedProjectRow.hackatimeTotalSeconds = 3 * 3600;
    state.rangeFetchTotalSeconds = 3 * 3600;

    const { res, json } = await postReview({
      decision: "approved",
      comment: "approved after range adjustment",
      approvedHours: 3,
      consideredHackatimeRange: {
        startDate: "2026-03-10",
        endDate: "2026-03-20",
      },
      reviewJustification: buildValidReviewJustification({
        reviewDateRange: {
          startDate: "2026-03-10",
          endDate: "2026-03-20",
        },
      }),
    });

    expect(res.status).toBe(200);
    expect(state.hackatimeRangeFetchCalls.length).toBe(1);
    expect(state.hackatimeRangeFetchCalls[0][0]).toBe("project-creator-1");
    expect(state.hackatimeRangeFetchCalls[0][1]).toEqual({
      projectName: "project-one",
      range: {
        startDate: "2026-03-10",
        endDate: "2026-03-20",
      },
    });
    expect(state.insertedReviews[0].hackatimeSnapshotSeconds).toBe(3 * 3600);
    expect(state.updateSets[0]).toMatchObject({
      approvedHours: 3,
      hackatimeTotalSeconds: 3 * 3600,
    });
    expect(state.updateSets[0].hackatimeStartedAt.toISOString()).toBe("2026-03-10T00:00:00.000Z");
    expect(state.updateSets[0].hackatimeStoppedAt.toISOString()).toBe("2026-03-20T23:59:59.999Z");
    expect(json.project.status).toBe("shipped");
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

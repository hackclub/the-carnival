import { beforeEach, describe, expect, mock, test } from "bun:test";
import { bountyProject, peerReview, project, tokenLedger } from "@/db/schema";

const state = {
  session: {
    user: {
      id: "admin-1",
      role: "admin",
    },
  },
  currentProjectRow: null,
  updatedProjectRow: null,
  updateSets: [],
  tokenInserts: [],
  ledgerKeys: new Set(),
  bountyRows: [],
  rangeRefreshCalls: [],
  rangeRefreshTotalSeconds: 4 * 3600,
};

function resetState() {
  state.session = {
    user: {
      id: "admin-1",
      role: "admin",
    },
  };
  state.currentProjectRow = {
    id: "project-1",
    status: "work-in-progress",
    creatorId: "creator-1",
    approvedHours: null,
    bountyProjectId: null,
    hackatimeProjectName: "project-one",
    hackatimeStartedAt: new Date("2026-03-01T00:00:00.000Z"),
    hackatimeStoppedAt: new Date("2026-03-31T23:59:59.999Z"),
    hackatimeTotalSeconds: 5 * 3600,
    submittedAt: null,
  };
  state.updatedProjectRow = {
    id: "project-1",
    status: "work-in-progress",
    approvedHours: null,
    hackatimeStartedAt: new Date("2026-03-10T00:00:00.000Z"),
    hackatimeStoppedAt: new Date("2026-03-20T23:59:59.999Z"),
    hackatimeTotalSeconds: 4 * 3600,
    submittedAt: null,
    updatedAt: new Date("2026-03-20T12:00:00.000Z"),
  };
  state.updateSets = [];
  state.tokenInserts = [];
  state.ledgerKeys = new Set();
  state.bountyRows = [];
  state.rangeRefreshCalls = [];
  state.rangeRefreshTotalSeconds = 4 * 3600;
}

function buildDb() {
  return {
    select() {
      const query = {
        sourceTable: null,
        from(table) {
          query.sourceTable = table;
          return query;
        },
        leftJoin() {
          return query;
        },
        where() {
          return query;
        },
        orderBy: async () => (query.sourceTable === peerReview ? [] : []),
        limit: async () => {
          if (query.sourceTable === project && state.currentProjectRow) return [state.currentProjectRow];
          if (query.sourceTable === tokenLedger) return [];
          if (query.sourceTable === bountyProject) return state.bountyRows;
          return [];
        },
      };
      return query;
    },
    update() {
      return {
        set(values) {
          state.updateSets.push(values);
          return {
            where() {
              return {
                returning: async () => (state.updatedProjectRow ? [state.updatedProjectRow] : []),
              };
            },
          };
        },
      };
    },
    transaction(callback) {
      const tx = {
        select() {
          const query = {
            sourceTable: null,
            from(table) {
              query.sourceTable = table;
              return query;
            },
            where() {
              return query;
            },
            limit: async () => {
              if (query.sourceTable === project && state.currentProjectRow) return [state.currentProjectRow];
              if (query.sourceTable === tokenLedger) return [];
              if (query.sourceTable === bountyProject) return state.bountyRows;
              return [];
            },
          };
          return query;
        },
        update() {
          return {
            set(values) {
              state.updateSets.push(values);
              if (state.currentProjectRow && values.status) {
                state.currentProjectRow = { ...state.currentProjectRow, ...values };
              }
              return {
                where: async () => [],
              };
            },
          };
        },
        insert(table) {
          return {
            values(values) {
              return {
                onConflictDoNothing: async () => {
                  if (table === tokenLedger) {
                    const key = `${values.referenceType}:${values.referenceId}:${values.kind}`;
                    if (!state.ledgerKeys.has(key)) {
                      state.ledgerKeys.add(key);
                      state.tokenInserts.push(values);
                    }
                  }
                  return [];
                },
              };
            },
          };
        },
      };
      return callback(tx);
    },
  };
}

mock.module("@/db", () => ({
  db: buildDb(),
}));
mock.module("@/lib/server-session", () => ({
  getServerSession: async () => state.session,
}));
mock.module("@/lib/hackatime", () => ({
  refreshHackatimeProjectSnapshotForRange: async (...args) => {
    state.rangeRefreshCalls.push(args);
    return {
      hackatimeStartedAt: new Date(`${args[1].range.startDate}T00:00:00.000Z`),
      hackatimeStoppedAt: new Date(`${args[1].range.endDate}T23:59:59.999Z`),
      hackatimeTotalSeconds: state.rangeRefreshTotalSeconds,
      hours: {
        hours: Math.floor(state.rangeRefreshTotalSeconds / 3600),
        minutes: Math.floor(state.rangeRefreshTotalSeconds / 60) % 60,
      },
    };
  },
}));
mock.module("@/lib/airtable", () => ({
  createAirtableGrantRecord: async () => ({ id: "airtable-1" }),
  toAirtableCreateErrorDetails: () => ({ message: "airtable failed", hints: [] }),
  getAirtableConfigErrors: () => [],
  AIRTABLE_GRANTS_TABLE_ENV: "AIRTABLE_GRANTS_TABLE",
}));

const { PATCH } = await import("./route.ts");

async function patchAdminProject(body) {
  const req = new Request("http://localhost/api/admin/projects/project-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await PATCH(req, { params: Promise.resolve({ id: "project-1" }) });
  const json = await res.json();
  return { res, json };
}

describe("PATCH /api/admin/projects/[id]", () => {
  beforeEach(() => {
    resetState();
  });

  test("persists a standalone admin range refresh", async () => {
    const { res, json } = await patchAdminProject({
      consideredHackatimeRange: {
        startDate: "2026-03-10",
        endDate: "2026-03-20",
      },
    });

    expect(res.status).toBe(200);
    expect(state.rangeRefreshCalls).toEqual([
      [
        "creator-1",
        {
          projectName: "project-one",
          range: {
            startDate: "2026-03-10",
            endDate: "2026-03-20",
          },
        },
      ],
    ]);
    expect(state.updateSets[0].status).toBe("work-in-progress");
    expect(state.updateSets[0].hackatimeTotalSeconds).toBe(4 * 3600);
    expect(json.project.status).toBe("work-in-progress");
  });

  test("blocks standalone range edits for granted projects", async () => {
    state.currentProjectRow.status = "granted";

    const { res, json } = await patchAdminProject({
      consideredHackatimeRange: {
        startDate: "2026-03-10",
        endDate: "2026-03-20",
      },
    });

    expect(res.status).toBe(409);
    expect(json.error).toContain("Granted projects");
    expect(state.rangeRefreshCalls).toEqual([]);
    expect(state.updateSets).toEqual([]);
  });

  test("returns shipped projects to review when refreshed hours fall below approved hours", async () => {
    state.currentProjectRow.status = "shipped";
    state.currentProjectRow.approvedHours = 3;
    state.updatedProjectRow.status = "in-review";
    state.updatedProjectRow.approvedHours = null;
    state.updatedProjectRow.submittedAt = new Date("2026-03-20T12:30:00.000Z");
    state.rangeRefreshTotalSeconds = 2 * 3600;

    const { res, json } = await patchAdminProject({
      consideredHackatimeRange: {
        startDate: "2026-03-14",
        endDate: "2026-03-15",
      },
    });

    expect(res.status).toBe(200);
    expect(state.updateSets[0].status).toBe("in-review");
    expect(state.updateSets[0].approvedHours).toBeNull();
    expect(state.updateSets[0].submittedAt).toBeInstanceOf(Date);
    expect(json.project.status).toBe("in-review");
    expect(json.notice).toContain("returned the project to review");
  });

  test("granting a linked project issues project and bounty bonus tokens", async () => {
    state.currentProjectRow.status = "shipped";
    state.currentProjectRow.approvedHours = 7.5;
    state.currentProjectRow.bountyProjectId = "bounty-1";
    state.currentProjectRow.name = "Project One";
    state.currentProjectRow.codeUrl = "https://github.com/example/project-one";
    state.bountyRows = [
      {
        id: "bounty-1",
        name: "Bonus bounty",
        prizeUsd: 40,
        status: "approved",
      },
    ];

    const { res } = await patchAdminProject({ status: "granted" });

    expect(res.status).toBe(200);
    expect(state.tokenInserts).toHaveLength(2);
    expect(state.tokenInserts[0].referenceType).toBe("project_grant");
    expect(state.tokenInserts[0].tokens).toBe(70);
    expect(state.tokenInserts[1].referenceType).toBe("bounty_bonus");
    expect(state.tokenInserts[1].referenceId).toBe("project-1:bounty-1");
    expect(state.tokenInserts[1].tokens).toBe(100);
  });

  test("bounty bonus is based on bounty payout, not approved project hours", async () => {
    state.currentProjectRow.status = "shipped";
    state.currentProjectRow.approvedHours = 1;
    state.currentProjectRow.bountyProjectId = "bounty-1";
    state.currentProjectRow.name = "Small Hours";
    state.currentProjectRow.codeUrl = "https://github.com/example/small";
    state.bountyRows = [
      {
        id: "bounty-1",
        name: "Big bonus",
        prizeUsd: 400,
        status: "approved",
      },
    ];

    const { res } = await patchAdminProject({ status: "granted" });

    expect(res.status).toBe(200);
    const bonus = state.tokenInserts.find((row) => row.referenceType === "bounty_bonus");
    expect(bonus.tokens).toBe(1000);
    expect(state.tokenInserts.find((row) => row.referenceType === "project_grant").tokens).toBe(10);
  });

  test("repeated grant calls do not duplicate project or bounty ledger entries", async () => {
    state.currentProjectRow.status = "shipped";
    state.currentProjectRow.approvedHours = 3;
    state.currentProjectRow.bountyProjectId = "bounty-1";
    state.currentProjectRow.name = "Repeat Grant";
    state.currentProjectRow.codeUrl = "https://github.com/example/repeat";
    state.bountyRows = [
      {
        id: "bounty-1",
        name: "Repeat bonus",
        prizeUsd: 40,
        status: "approved",
      },
    ];

    const first = await patchAdminProject({ status: "granted" });
    const second = await patchAdminProject({ status: "granted" });

    expect(first.res.status).toBe(200);
    expect(second.res.status).toBe(200);
    expect(state.tokenInserts.filter((row) => row.referenceType === "project_grant")).toHaveLength(1);
    expect(state.tokenInserts.filter((row) => row.referenceType === "bounty_bonus")).toHaveLength(1);
  });
});

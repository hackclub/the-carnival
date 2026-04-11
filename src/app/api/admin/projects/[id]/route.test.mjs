import { beforeEach, describe, expect, mock, test } from "bun:test";
import { project } from "@/db/schema";

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
        where() {
          return query;
        },
        limit: async () => (query.sourceTable === project && state.currentProjectRow ? [state.currentProjectRow] : []),
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
    transaction() {
      throw new Error("transaction should not be called in standalone range update tests");
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
});

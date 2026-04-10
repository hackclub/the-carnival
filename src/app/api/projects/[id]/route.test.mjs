import { beforeEach, describe, expect, mock, test } from "bun:test";
import { project, user } from "@/db/schema";

const VALID_SUBMISSION_CHECKLIST = {
  readmeInstructions: true,
  testedWorking: true,
  usedAi: false,
  githubPublic: true,
  descriptionClear: true,
  screenshotsWorking: true,
};

const state = {
  session: {
    user: {
      id: "creator-1",
      role: "user",
    },
  },
  freezeState: {
    isFrozen: false,
    frozenReason: null,
  },
  currentProjectRow: null,
  priorSubmittedRows: [{ id: "prior-project" }],
  creatorRows: [],
  updatedProjectRow: null,
  projectSelectCalls: 0,
  updateSets: [],
  rangeFetchCalls: [],
  rangeFetchTotalSeconds: 5400,
};

function resetState() {
  state.session = {
    user: {
      id: "creator-1",
      role: "user",
    },
  };
  state.freezeState = {
    isFrozen: false,
    frozenReason: null,
  };
  state.currentProjectRow = {
    status: "work-in-progress",
    approvedHours: null,
    name: "Project One",
    description: "A project",
    category: null,
    tags: [],
    editor: "vscode",
    editorOther: null,
    hackatimeProjectName: "project-one",
    hackatimeStartedAt: new Date("2026-03-01T00:00:00.000Z"),
    hackatimeStoppedAt: new Date("2026-03-31T23:59:59.999Z"),
    hackatimeTotalSeconds: 7200,
    videoUrl: "https://example.com/video",
    playableDemoUrl: "https://example.com/demo",
    codeUrl: "https://github.com/example/project-one",
    screenshots: ["https://example.com/shot-1.png"],
    submissionChecklist: { ...VALID_SUBMISSION_CHECKLIST },
    creatorDeclaredOriginality: true,
    creatorDuplicateExplanation: null,
    creatorOriginalityRationale: null,
    submittedAt: null,
    createdAt: new Date("2026-03-01T10:00:00.000Z"),
  };
  state.priorSubmittedRows = [{ id: "prior-project" }];
  state.creatorRows = [];
  state.updatedProjectRow = {
    id: "project-1",
    creatorId: "creator-1",
    name: "Project One",
    description: "A project",
    category: null,
    tags: [],
    editor: "vscode",
    editorOther: null,
    hackatimeProjectName: "project-one",
    hackatimeStartedAt: new Date("2026-03-10T00:00:00.000Z"),
    hackatimeStoppedAt: new Date("2026-03-20T23:59:59.999Z"),
    hackatimeTotalSeconds: 5400,
    videoUrl: "https://example.com/video",
    playableDemoUrl: "https://example.com/demo",
    codeUrl: "https://github.com/example/project-one",
    screenshots: ["https://example.com/shot-1.png"],
    submissionChecklist: { ...VALID_SUBMISSION_CHECKLIST },
    creatorDeclaredOriginality: true,
    creatorDuplicateExplanation: null,
    creatorOriginalityRationale: null,
    status: "in-review",
    createdAt: new Date("2026-03-01T10:00:00.000Z"),
    updatedAt: new Date("2026-03-20T12:00:00.000Z"),
  };
  state.projectSelectCalls = 0;
  state.updateSets = [];
  state.rangeFetchCalls = [];
  state.rangeFetchTotalSeconds = 5400;
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
        limit: async () => {
          if (query.sourceTable === project) {
            state.projectSelectCalls += 1;
            return state.projectSelectCalls === 1
              ? (state.currentProjectRow ? [state.currentProjectRow] : [])
              : state.priorSubmittedRows;
          }
          if (query.sourceTable === user) {
            return state.creatorRows;
          }
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
    delete() {
      throw new Error("delete should not be called in this test");
    },
  };
}

mock.module("@/db", () => ({
  db: buildDb(),
}));
mock.module("@/lib/server-session", () => ({
  getServerSession: async () => state.session,
}));
mock.module("@/lib/frozen-account", () => ({
  getFrozenAccountState: async () => state.freezeState,
  getFrozenAccountMessage: () => "Frozen",
}));
mock.module("@/lib/hackatime", () => ({
  fetchHackatimeProjectTotalSecondsForRange: async (...args) => {
    state.rangeFetchCalls.push(args);
    return { totalSeconds: state.rangeFetchTotalSeconds };
  },
}));
mock.module("@/lib/slack", () => ({
  notifyReviewDM: async () => undefined,
}));

const { PATCH } = await import("./route.ts");

async function patchProject(body) {
  state.projectSelectCalls = 0;
  const req = new Request("http://localhost/api/projects/project-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await PATCH(req, { params: Promise.resolve({ id: "project-1" }) });
  const json = await res.json();
  return { res, json };
}

describe("PATCH /api/projects/[id]", () => {
  beforeEach(() => {
    resetState();
  });

  test("recalculates and persists the canonical considered range on submission", async () => {
    const { res, json } = await patchProject({
      status: "in-review",
      consideredHackatimeRange: {
        startDate: "2026-03-10",
        endDate: "2026-03-20",
      },
    });

    expect(res.status).toBe(200);
    expect(state.rangeFetchCalls).toEqual([
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
    expect(state.updateSets).toHaveLength(1);
    expect(state.updateSets[0].status).toBe("in-review");
    expect(state.updateSets[0].hackatimeStartedAt.toISOString()).toBe("2026-03-10T00:00:00.000Z");
    expect(state.updateSets[0].hackatimeStoppedAt.toISOString()).toBe("2026-03-20T23:59:59.999Z");
    expect(state.updateSets[0].hackatimeTotalSeconds).toBe(5400);
    expect(state.updateSets[0].submittedAt).toBeInstanceOf(Date);
    expect(json.project.hackatimeTotalSeconds).toBe(5400);
    expect(json.project.status).toBe("in-review");
  });
});

import { beforeEach, describe, expect, mock, test } from "bun:test";

const state = {
  session: {
    user: {
      id: "creator-1",
    },
  },
  freezeState: {
    isFrozen: false,
    frozenReason: null,
  },
  insertedProjectValues: null,
  rangeRefreshCalls: [],
  rangeRefreshTotalSeconds: 3660,
};

function resetState() {
  state.session = {
    user: {
      id: "creator-1",
    },
  };
  state.freezeState = {
    isFrozen: false,
    frozenReason: null,
  };
  state.insertedProjectValues = null;
  state.rangeRefreshCalls = [];
  state.rangeRefreshTotalSeconds = 3660;
}

const db = {
  insert() {
    return {
      values: async (values) => {
        state.insertedProjectValues = values;
        return [values];
      },
    };
  },
};

mock.module("@/db", () => ({ db }));
mock.module("@/lib/server-session", () => ({
  getServerSession: async () => state.session,
}));
mock.module("@/lib/frozen-account", () => ({
  getFrozenAccountState: async () => state.freezeState,
  getFrozenAccountMessage: () => "Frozen",
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

const { POST } = await import("./route.ts");

const BASE_BODY = {
  name: "Project One",
  description: "A cool project",
  editor: "vscode",
  editorOther: "",
  category: "games",
  tags: "multiplayer, web",
  videoUrl: "https://example.com/video",
  playableDemoUrl: "https://example.com/demo",
  codeUrl: "https://github.com/example/project-one",
  screenshots: [
    "https://example.com/shot-1.png",
    "https://example.com/shot-2.png",
    "https://example.com/shot-3.png",
  ],
  creatorDeclaredOriginality: true,
  creatorDuplicateExplanation: "",
  creatorOriginalityRationale: "",
};

async function createProject(body) {
  const req = new Request("http://localhost/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await POST(req);
  const json = await res.json();
  return { res, json };
}

describe("POST /api/projects", () => {
  beforeEach(() => {
    resetState();
  });

  test("persists canonical Hackatime snapshot fields from the considered range", async () => {
    const { res } = await createProject({
      ...BASE_BODY,
      hackatimeProjectName: "project-one",
      consideredHackatimeRange: {
        startDate: "2026-03-10",
        endDate: "2026-03-20",
      },
    });

    expect(res.status).toBe(201);
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
    expect(state.insertedProjectValues.hackatimeStartedAt.toISOString()).toBe("2026-03-10T00:00:00.000Z");
    expect(state.insertedProjectValues.hackatimeStoppedAt.toISOString()).toBe("2026-03-20T23:59:59.999Z");
    expect(state.insertedProjectValues.hackatimeTotalSeconds).toBe(3660);
  });

  test("allows creating a project without a Hackatime selection", async () => {
    const { res } = await createProject({
      ...BASE_BODY,
      hackatimeProjectName: "",
    });

    expect(res.status).toBe(201);
    expect(state.rangeRefreshCalls).toEqual([]);
    expect(state.insertedProjectValues.hackatimeProjectName).toBe("");
    expect(state.insertedProjectValues.hackatimeStartedAt).toBeNull();
    expect(state.insertedProjectValues.hackatimeStoppedAt).toBeNull();
    expect(state.insertedProjectValues.hackatimeTotalSeconds).toBeNull();
  });
});

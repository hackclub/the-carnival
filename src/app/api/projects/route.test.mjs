import { beforeEach, describe, expect, mock, test } from "bun:test";
import { bountyProject } from "@/db/schema";

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
  bountyRows: [],
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
  state.bountyRows = [];
}

const db = {
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
      limit: async () => (query.sourceTable === bountyProject ? state.bountyRows : []),
    };
    return query;
  },
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

  test("allows creating a draft before submission links are filled in", async () => {
    const { res } = await createProject({
      ...BASE_BODY,
      hackatimeProjectName: "",
      videoUrl: "",
      playableDemoUrl: "",
      codeUrl: "",
    });

    expect(res.status).toBe(201);
    expect(state.insertedProjectValues.videoUrl).toBe("");
    expect(state.insertedProjectValues.playableDemoUrl).toBe("");
    expect(state.insertedProjectValues.codeUrl).toBe("");
  });

  test("accepts an approved open bounty link", async () => {
    state.bountyRows = [{ id: "bounty-1", status: "approved", completed: false }];

    const { res } = await createProject({
      ...BASE_BODY,
      hackatimeProjectName: "",
      bountyProjectId: "bounty-1",
    });

    expect(res.status).toBe(201);
    expect(state.insertedProjectValues.bountyProjectId).toBe("bounty-1");
  });

  test("rejects pending and completed bounty links", async () => {
    state.bountyRows = [{ id: "bounty-1", status: "pending", completed: false }];
    const pending = await createProject({
      ...BASE_BODY,
      hackatimeProjectName: "",
      bountyProjectId: "bounty-1",
    });
    expect(pending.res.status).toBe(400);
    expect(pending.json.error).toContain("not official");

    state.bountyRows = [{ id: "bounty-1", status: "approved", completed: true }];
    const completed = await createProject({
      ...BASE_BODY,
      hackatimeProjectName: "",
      bountyProjectId: "bounty-1",
    });
    expect(completed.res.status).toBe(400);
    expect(completed.json.error).toContain("completed");
  });
});

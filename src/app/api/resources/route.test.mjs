import { beforeEach, describe, expect, mock, test } from "bun:test";

const state = {
  session: { user: { id: "user-1", role: "user" } },
  editorRow: { id: "editor-1" },
  inserted: null,
};

function resetState() {
  state.session = { user: { id: "user-1", role: "user" } };
  state.editorRow = { id: "editor-1" };
  state.inserted = null;
}

const db = {
  select() {
    const query = {
      from() {
        return query;
      },
      where: async () => (state.editorRow ? [state.editorRow] : []),
    };
    return query;
  },
  insert() {
    return {
      values: async (values) => {
        state.inserted = values;
      },
    };
  },
};

mock.module("@/db", () => ({ db }));
mock.module("@/lib/server-session", () => ({
  getServerSession: async () => state.session,
}));

const { POST } = await import("./route.ts");

async function postResource(body) {
  const req = new Request("http://localhost/api/resources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await POST(req);
  const json = await res.json();
  return { res, json };
}

const valid = {
  editorId: "editor-1",
  title: "Getting started",
  url: "https://example.com/docs",
  description: "Intro guide",
  type: "documentation",
};

describe("POST /api/resources", () => {
  beforeEach(() => {
    resetState();
  });

  test("stores a valid http(s) resource", async () => {
    const { res, json } = await postResource(valid);

    expect(res.status).toBe(201);
    expect(typeof json.id).toBe("string");
    expect(state.inserted.url).toBe("https://example.com/docs");
    expect(state.inserted.title).toBe("Getting started");
    expect(state.inserted.description).toBe("Intro guide");
  });

  test("rejects non-http(s) URLs", async () => {
    for (const url of ["javascript:alert(1)", "ftp://example.com/x", "example.com/docs", "not a url"]) {
      resetState();
      const { res, json } = await postResource({ ...valid, url });

      expect(res.status).toBe(400);
      expect(json.error).toBe("URL must be a valid http(s) link");
      expect(state.inserted).toBeNull();
    }
  });

  test("rejects a missing URL", async () => {
    const { res, json } = await postResource({ ...valid, url: "" });

    expect(res.status).toBe(400);
    expect(json.error).toBe("URL is required");
    expect(state.inserted).toBeNull();
  });

  test("caps title and description length", async () => {
    const { res } = await postResource({
      ...valid,
      title: "t".repeat(500),
      description: "d".repeat(10_000),
    });

    expect(res.status).toBe(201);
    expect(state.inserted.title).toHaveLength(120);
    expect(state.inserted.description).toHaveLength(5000);
  });

  test("still requires a signed-in user", async () => {
    state.session = null;

    const { res } = await postResource(valid);

    expect(res.status).toBe(401);
    expect(state.inserted).toBeNull();
  });
});

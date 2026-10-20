import { beforeEach, describe, expect, mock, test } from "bun:test";

const state = {
  session: { user: { id: "admin-1", role: "admin" } },
  existing: { id: "resource-1" },
  updateSet: null,
};

function resetState() {
  state.session = { user: { id: "admin-1", role: "admin" } };
  state.existing = { id: "resource-1" };
  state.updateSet = null;
}

const db = {
  select() {
    const query = {
      from() {
        return query;
      },
      where: async () => (state.existing ? [state.existing] : []),
    };
    return query;
  },
  update() {
    return {
      set(values) {
        state.updateSet = values;
        return { where: async () => [] };
      },
    };
  },
};

mock.module("@/db", () => ({ db }));
mock.module("@/lib/server-session", () => ({
  getServerSession: async () => state.session,
}));

const { PATCH } = await import("./route.ts");

async function patchResource(body) {
  const req = new Request("http://localhost/api/resources/resource-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await PATCH(req, { params: Promise.resolve({ id: "resource-1" }) });
  const json = await res.json();
  return { res, json };
}

describe("PATCH /api/resources/[id]", () => {
  beforeEach(() => {
    resetState();
  });

  test("updates a valid http(s) URL", async () => {
    const { res } = await patchResource({ url: " https://example.com/new " });

    expect(res.status).toBe(200);
    expect(state.updateSet.url).toBe("https://example.com/new");
  });

  test("rejects non-http(s) URLs", async () => {
    const { res, json } = await patchResource({ url: "javascript:alert(1)" });

    expect(res.status).toBe(400);
    expect(json.error).toBe("URL must be a valid http(s) link");
    expect(state.updateSet).toBeNull();
  });

  test("rejects an empty URL", async () => {
    const { res, json } = await patchResource({ url: "" });

    expect(res.status).toBe(400);
    expect(json.error).toBe("URL cannot be empty");
    expect(state.updateSet).toBeNull();
  });

  test("caps title and description length", async () => {
    const { res } = await patchResource({
      title: "t".repeat(500),
      description: "d".repeat(10_000),
    });

    expect(res.status).toBe(200);
    expect(state.updateSet.title).toHaveLength(120);
    expect(state.updateSet.description).toHaveLength(5000);
  });
});

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const R2_BASE = "https://cdn.example.com/carnival";

const state = {
  session: { user: { id: "admin-1", role: "admin" } },
  existing: { id: "editor-1" },
  updateSet: null,
};

function resetState() {
  state.session = { user: { id: "admin-1", role: "admin" } };
  state.existing = { id: "editor-1" };
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

async function patchEditor(body) {
  const req = new Request("http://localhost/api/editors/editor-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await PATCH(req, { params: Promise.resolve({ id: "editor-1" }) });
  const json = await res.json();
  return { res, json };
}

describe("PATCH /api/editors/[id]", () => {
  let previousBase;

  beforeEach(() => {
    resetState();
    previousBase = process.env.R2_PUBLIC_BASE_URL;
    process.env.R2_PUBLIC_BASE_URL = R2_BASE;
  });

  afterEach(() => {
    if (previousBase === undefined) delete process.env.R2_PUBLIC_BASE_URL;
    else process.env.R2_PUBLIC_BASE_URL = previousBase;
  });

  test("accepts a platform-hosted icon and clears it with null", async () => {
    const iconUrl = `${R2_BASE}/editor_icon/abc.jpg`;
    const first = await patchEditor({ iconUrl });
    expect(first.res.status).toBe(200);
    expect(state.updateSet.iconUrl).toBe(iconUrl);

    const second = await patchEditor({ iconUrl: null });
    expect(second.res.status).toBe(200);
    expect(state.updateSet.iconUrl).toBeNull();
  });

  test("rejects external image links", async () => {
    const { res, json } = await patchEditor({ iconUrl: "https://evil.example/pixel.png" });

    expect(res.status).toBe(400);
    expect(json.error).toContain("uploaded here directly");
    expect(state.updateSet).toBeNull();
  });

  test("rejects non-http(s) icon URLs", async () => {
    const { res, json } = await patchEditor({ iconUrl: "data:image/png;base64,AAAA" });

    expect(res.status).toBe(400);
    expect(json.error).toBe("Icon URL must be a valid http(s) link");
    expect(state.updateSet).toBeNull();
  });

  test("caps name, slug and description length", async () => {
    const { res } = await patchEditor({
      name: "n".repeat(500),
      slug: "s".repeat(500),
      description: "d".repeat(10_000),
    });

    expect(res.status).toBe(200);
    expect(state.updateSet.name).toHaveLength(120);
    expect(state.updateSet.slug).toHaveLength(120);
    expect(state.updateSet.description).toHaveLength(5000);
  });
});

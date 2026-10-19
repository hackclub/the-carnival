import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const R2_BASE = "https://cdn.example.com/carnival";

const state = {
  session: { user: { id: "user-1", role: "user" } },
  inserted: null,
};

function resetState() {
  state.session = { user: { id: "user-1", role: "user" } };
  state.inserted = null;
}

const db = {
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

async function postEditor(body) {
  const req = new Request("http://localhost/api/editors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await POST(req);
  const json = await res.json();
  return { res, json };
}

describe("POST /api/editors", () => {
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

  test("creates an editor without an icon", async () => {
    const { res, json } = await postEditor({ name: "VS Code", description: "Editor", iconUrl: null });

    expect(res.status).toBe(201);
    expect(typeof json.id).toBe("string");
    expect(state.inserted.name).toBe("VS Code");
    expect(state.inserted.slug).toBe("vs-code");
    expect(state.inserted.iconUrl).toBeNull();
  });

  test("accepts an icon uploaded through the platform", async () => {
    const iconUrl = `${R2_BASE}/editor_icon/abc.png`;
    const { res } = await postEditor({ name: "VS Code", iconUrl });

    expect(res.status).toBe(201);
    expect(state.inserted.iconUrl).toBe(iconUrl);
  });

  test("rejects external image links", async () => {
    const { res, json } = await postEditor({ name: "VS Code", iconUrl: "https://evil.example/pixel.png" });

    expect(res.status).toBe(400);
    expect(json.error).toContain("uploaded here directly");
    expect(state.inserted).toBeNull();
  });

  test("rejects disallowed image types even on the platform bucket", async () => {
    const { res, json } = await postEditor({ name: "VS Code", iconUrl: `${R2_BASE}/editor_icon/abc.svg` });

    expect(res.status).toBe(400);
    expect(json.error).toContain("PNG or JPG");
    expect(state.inserted).toBeNull();
  });

  test("rejects non-http(s) icon URLs", async () => {
    const { res, json } = await postEditor({ name: "VS Code", iconUrl: "javascript:alert(1)" });

    expect(res.status).toBe(400);
    expect(json.error).toBe("Icon URL must be a valid http(s) link");
    expect(state.inserted).toBeNull();
  });

  test("caps name, slug and description length", async () => {
    const { res } = await postEditor({ name: "n".repeat(500), description: "d".repeat(10_000) });

    expect(res.status).toBe(201);
    expect(state.inserted.name).toHaveLength(120);
    expect(state.inserted.slug).toHaveLength(120);
    expect(state.inserted.description).toHaveLength(5000);
  });

  test("still requires a signed-in user", async () => {
    state.session = null;

    const { res } = await postEditor({ name: "VS Code" });

    expect(res.status).toBe(401);
    expect(state.inserted).toBeNull();
  });
});

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { validatePlatformImageUrl } from "./uploads.ts";

const R2_BASE = "https://cdn.example.com/carnival";

describe("validatePlatformImageUrl", () => {
  let previousBase;
  let previousNodeEnv;

  beforeEach(() => {
    previousBase = process.env.R2_PUBLIC_BASE_URL;
    previousNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    if (previousBase === undefined) delete process.env.R2_PUBLIC_BASE_URL;
    else process.env.R2_PUBLIC_BASE_URL = previousBase;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  });

  test("accepts PNG/JPG uploads on the configured bucket", () => {
    process.env.R2_PUBLIC_BASE_URL = R2_BASE;

    expect(validatePlatformImageUrl(`${R2_BASE}/editor_icon/a.png`, "Icon")).toEqual({ ok: true });
    expect(validatePlatformImageUrl(`${R2_BASE}/x/b.jpg`, "Icon")).toEqual({ ok: true });
    expect(validatePlatformImageUrl(`${R2_BASE}/x/c.JPEG`, "Icon")).toEqual({ ok: true });
  });

  test("rejects images hosted anywhere else when a bucket is configured", () => {
    process.env.R2_PUBLIC_BASE_URL = R2_BASE;

    const result = validatePlatformImageUrl("https://evil.example/pixel.png", "Icon");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("uploaded here directly");
  });

  test("rejects non-http(s) and non-PNG/JPG URLs before looking at the bucket", () => {
    process.env.R2_PUBLIC_BASE_URL = R2_BASE;

    expect(validatePlatformImageUrl("javascript:alert(1)", "Icon").error).toBe("Icon must be a valid URL.");
    expect(validatePlatformImageUrl(`${R2_BASE}/x/a.svg`, "Icon").error).toContain("PNG or JPG");
    expect(validatePlatformImageUrl(`${R2_BASE}/x/noext`, "Icon").error).toContain("PNG or JPG");
  });

  test("fails closed in production when no bucket is configured", () => {
    delete process.env.R2_PUBLIC_BASE_URL;
    process.env.NODE_ENV = "production";

    const result = validatePlatformImageUrl("https://evil.example/pixel.png", "Icon");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not configured");
  });

  test("outside production, no bucket means only the extension rule applies", () => {
    delete process.env.R2_PUBLIC_BASE_URL;
    process.env.NODE_ENV = "development";

    expect(validatePlatformImageUrl("https://anywhere.example/pixel.png", "Icon")).toEqual({ ok: true });
    expect(validatePlatformImageUrl("https://anywhere.example/pixel.gif", "Icon").ok).toBe(false);
  });
});

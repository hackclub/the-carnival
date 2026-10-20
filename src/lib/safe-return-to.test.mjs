import { describe, expect, test } from "bun:test";
import { DEFAULT_RETURN_TO, safeReturnTo } from "./safe-return-to.ts";

const ORIGIN = "https://carnival.hackclub.com";

describe("safeReturnTo", () => {
  test("keeps same-origin relative paths, including query strings", () => {
    expect(safeReturnTo("/projects?new=1", ORIGIN)).toBe("/projects?new=1");
    expect(safeReturnTo("/projects/abc?tab=hackatime", ORIGIN)).toBe("/projects/abc?tab=hackatime");
    expect(safeReturnTo("  /projects  ", ORIGIN)).toBe("/projects");
    expect(safeReturnTo("/", ORIGIN)).toBe("/");
  });

  test("rejects protocol-relative URLs", () => {
    expect(safeReturnTo("//evil.com/x", ORIGIN)).toBe(DEFAULT_RETURN_TO);
  });

  test("rejects backslash-prefixed hosts", () => {
    expect(safeReturnTo("/\\evil.com", ORIGIN)).toBe(DEFAULT_RETURN_TO);
  });

  test("rejects encoded slashes in the first segment, any case", () => {
    expect(safeReturnTo("/%2F%2Fevil.com", ORIGIN)).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnTo("/%2f%2fevil.com", ORIGIN)).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnTo("/%5Cevil.com", ORIGIN)).toBe(DEFAULT_RETURN_TO);
  });

  test("rejects absolute URLs, even on the same origin", () => {
    expect(safeReturnTo("https://evil.com", ORIGIN)).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnTo(`${ORIGIN}/projects`, ORIGIN)).toBe(DEFAULT_RETURN_TO);
  });

  test("rejects whitespace tricks the URL parser would strip", () => {
    expect(safeReturnTo("/\t/evil.com", ORIGIN)).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnTo("/\n/evil.com", ORIGIN)).toBe(DEFAULT_RETURN_TO);
  });

  test("falls back for empty, missing or non-string input", () => {
    expect(safeReturnTo("", ORIGIN)).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnTo(null, ORIGIN)).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnTo(undefined, ORIGIN)).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnTo(42, ORIGIN)).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnTo("projects", ORIGIN)).toBe(DEFAULT_RETURN_TO);
  });

  test("works without an explicit origin", () => {
    expect(safeReturnTo("/projects?new=1")).toBe("/projects?new=1");
    expect(safeReturnTo("//evil.com/x")).toBe(DEFAULT_RETURN_TO);
  });
});

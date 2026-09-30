import { describe, expect, test } from "bun:test";
import { cleanUntrustedString, sanitizeHttpUrl, sanitizeText } from "./sanitize.ts";

const NUL = String.fromCharCode(0);
const BELL = String.fromCharCode(7);

describe("cleanUntrustedString", () => {
  test("strips control characters but keeps tabs and newlines", () => {
    expect(cleanUntrustedString(`  a${NUL}b\n\tc${BELL}  `)).toBe("ab\n\tc");
  });

  test("returns empty for non-strings", () => {
    expect(cleanUntrustedString(42)).toBe("");
  });
});

describe("sanitizeText", () => {
  test("single-line text drops newlines and control characters", () => {
    expect(sanitizeText(`  My${NUL} ext\nname  `, { maxLength: 50 })).toBe("My extname");
  });

  test("multiline text keeps newlines", () => {
    expect(sanitizeText(`a${BELL}\n\nb`, { maxLength: 50, multiline: true })).toBe("a\n\nb");
  });

  test("keeps emoji sequences intact", () => {
    const coder = "\u{1F9D1}\u{200D}\u{1F4BB} helper";
    expect(sanitizeText(coder, { maxLength: 50 })).toBe(coder);
  });

  test("caps length and handles non-strings", () => {
    expect(sanitizeText("abcdef", { maxLength: 3 })).toBe("abc");
    expect(sanitizeText(42, { maxLength: 3 })).toBe("");
  });
});

describe("sanitizeHttpUrl", () => {
  test("accepts http(s) URLs and returns empty for blank input", () => {
    expect(sanitizeHttpUrl(" https://github.com/a/b ")).toBe("https://github.com/a/b");
    expect(sanitizeHttpUrl("")).toBe("");
    expect(sanitizeHttpUrl(undefined)).toBe("");
  });

  test("rejects other schemes, credentials and junk", () => {
    expect(sanitizeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeHttpUrl("ftp://example.com/file")).toBeNull();
    expect(sanitizeHttpUrl("https://user:pw@example.com")).toBeNull();
    expect(sanitizeHttpUrl("github.com/a/b")).toBeNull();
    expect(sanitizeHttpUrl("not a url")).toBeNull();
    expect(sanitizeHttpUrl(123)).toBeNull();
  });
});

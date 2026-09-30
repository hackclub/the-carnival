import { describe, expect, test } from "bun:test";
import { sanitizeHttpUrl, sanitizeText } from "./sanitize.ts";

describe("sanitizeText", () => {
  test("strips control, zero-width and bidi characters", () => {
    expect(sanitizeText("a\u0000b\u200Bc\u202Ed", { maxLength: 50 })).toBe("abcd");
  });

  test("keeps zero-width joiners inside emoji sequences", () => {
    const coder = "\u{1F9D1}\u200D\u{1F4BB} helper";
    expect(sanitizeText(coder, { maxLength: 50 })).toBe(coder);
  });

  test("collapses whitespace for single-line text", () => {
    expect(sanitizeText("  hello \n\t world  ", { maxLength: 50 })).toBe("hello world");
  });

  test("keeps newlines for multiline text but limits blank runs", () => {
    expect(sanitizeText("a\r\n\n\n\nb", { maxLength: 50, multiline: true })).toBe("a\n\nb");
  });

  test("caps length and handles non-strings", () => {
    expect(sanitizeText("abcdef", { maxLength: 3 })).toBe("abc");
    expect(sanitizeText(42, { maxLength: 3 })).toBe("");
  });
});

describe("sanitizeHttpUrl", () => {
  test("accepts http(s) and returns empty for blank", () => {
    expect(sanitizeHttpUrl(" https://github.com/a/b ")).toBe("https://github.com/a/b");
    expect(sanitizeHttpUrl("")).toBe("");
  });

  test("rejects other schemes, credentials and junk", () => {
    expect(sanitizeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeHttpUrl("https://user:pw@example.com")).toBeNull();
    expect(sanitizeHttpUrl("not a url")).toBeNull();
  });
});

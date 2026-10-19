import { describe, expect, test } from "bun:test";
import { csvEscape } from "./csv.ts";

describe("csvEscape", () => {
  test("leaves plain values alone", () => {
    expect(csvEscape("Ada Lovelace")).toBe("Ada Lovelace");
    expect(csvEscape("")).toBe("");
    expect(csvEscape("ada@example.com")).toBe("ada@example.com");
  });

  test("quotes values with commas, quotes or newlines", () => {
    expect(csvEscape("Lovelace, Ada")).toBe('"Lovelace, Ada"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  test("neutralises leading formula characters", () => {
    expect(csvEscape("=HYPERLINK(\"https://evil.example\")")).toBe(
      "\"'=HYPERLINK(\"\"https://evil.example\"\")\"",
    );
    expect(csvEscape("+1234")).toBe("'+1234");
    expect(csvEscape("-cmd")).toBe("'-cmd");
    expect(csvEscape("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvEscape("\tname")).toBe("'\tname");
    expect(csvEscape("\rname")).toBe("\"'\rname\"");
  });

  test("only the first character triggers the guard", () => {
    expect(csvEscape("a=b")).toBe("a=b");
    expect(csvEscape("x+y")).toBe("x+y");
  });
});

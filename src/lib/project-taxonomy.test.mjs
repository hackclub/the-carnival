import { describe, expect, test } from "bun:test";
import {
  buildCategorySuggestions,
  buildTagSuggestions,
  formatCategoryLabel,
  normalizeCategory,
  normalizeProjectTags,
  normalizeTag,
} from "./project-taxonomy.ts";

describe("project-taxonomy", () => {
  test("normalizes category strings for de-duplication", () => {
    expect(normalizeCategory("  Game   Dev  ")).toBe("game dev");
    expect(normalizeCategory("")).toBeNull();
    expect(normalizeCategory(null)).toBeNull();
  });

  test("normalizes tags into lowercase slugs", () => {
    expect(normalizeTag(" #AI Tools ")).toBe("ai-tools");
    expect(normalizeTag("  3D   Art  ")).toBe("3d-art");
    expect(normalizeTag("!!!")).toBeNull();
  });

  test("parses and de-duplicates project tags", () => {
    expect(normalizeProjectTags("ai, ai, #web-dev, 3d art")).toEqual([
      "ai",
      "web-dev",
      "3d-art",
    ]);
    expect(normalizeProjectTags(["Design", "design", " "])).toEqual(["design"]);
  });

  test("builds sorted category and tag suggestions", () => {
    expect(
      buildCategorySuggestions(["Tools", "tools", "Game Dev", null]),
    ).toEqual(["game dev", "tools"]);
    expect(
      buildTagSuggestions([["AI", "tools"], ["#tools", "WEB"]]),
    ).toEqual(["ai", "tools", "web"]);
  });

  test("formats normalized labels for display", () => {
    expect(formatCategoryLabel("game dev")).toBe("Game Dev");
  });
});

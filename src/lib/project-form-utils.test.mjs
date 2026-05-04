import { describe, expect, test } from "bun:test";
import {
  appendCsvToken,
  cleanList,
  formatTotalSeconds,
  toDateInputValue,
  toHoursMinutes,
} from "./project-form-utils.ts";

describe("project-form-utils", () => {
  test("appends unique CSV tokens while preserving readable spacing", () => {
    expect(appendCsvToken("games, tools", "Tools")).toBe("games, tools");
    expect(appendCsvToken("games, tools", "art")).toBe("games, tools, art");
    expect(appendCsvToken(" ", " art ")).toBe("art");
  });

  test("cleans string lists for form payloads", () => {
    expect(cleanList([" one ", "", "two"])).toEqual(["one", "two"]);
  });

  test("formats Hackatime seconds consistently", () => {
    expect(toHoursMinutes(3660)).toEqual({ hours: 1, minutes: 1 });
    expect(formatTotalSeconds(3660)).toBe("1h01m");
    expect(formatTotalSeconds(null)).toBe("0h00m");
  });

  test("converts ISO values for date inputs", () => {
    expect(toDateInputValue("2026-05-04T12:30:00.000Z")).toBe("2026-05-04");
    expect(toDateInputValue("not-a-date")).toBe("");
    expect(toDateInputValue(null)).toBe("");
  });
});

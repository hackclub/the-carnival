import { describe, expect, test } from "bun:test";

const { readCarnivalDeadlineIso } = await import("./deadline.ts");
const { SITE_SETTING_DEFAULTS } = await import("../../site-settings-shared.ts");

function fakeDb(rowsOrError) {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: async () => {
      if (rowsOrError instanceof Error) throw rowsOrError;
      return rowsOrError;
    },
  };
  return { select: () => chain };
}

describe("readCarnivalDeadlineIso", () => {
  test("returns the stored deadline", async () => {
    expect(await readCarnivalDeadlineIso(fakeDb([{ value: "2026-10-31T23:59:59.000Z" }]))).toBe(
      "2026-10-31T23:59:59.000Z",
    );
  });
  test("falls back to the default when the row is missing, invalid, or the query fails", async () => {
    const fallback = SITE_SETTING_DEFAULTS.carnival_deadline;
    expect(await readCarnivalDeadlineIso(fakeDb([]))).toBe(fallback);
    expect(await readCarnivalDeadlineIso(fakeDb([{ value: "next tuesday" }]))).toBe(fallback);
    expect(await readCarnivalDeadlineIso(fakeDb(new Error("boom")))).toBe(fallback);
  });
});

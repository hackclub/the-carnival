import { describe, expect, test } from "bun:test";
import {
  normalizeProjectSubmissionChecklist,
  parseProjectSubmissionChecklist,
} from "./project-submission-checklist";

describe("project submission checklist helpers", () => {
  test("normalizes missing newer keys to false", () => {
    const checklist = normalizeProjectSubmissionChecklist({
      readmeInstructions: true,
      testedWorking: true,
      usedAi: false,
      githubPublic: true,
      descriptionClear: true,
      screenshotsWorking: true,
    });

    expect(checklist.didNotManipulateHackatimeData).toBe(false);
    expect(checklist.didNotCopyCodeWithoutAttribution).toBe(false);
  });

  test("parses legacy checklist payloads and fills missing keys", () => {
    const checklist = parseProjectSubmissionChecklist({
      readmeInstructions: true,
      testedWorking: true,
      usedAi: false,
      githubPublic: true,
      descriptionClear: false,
      screenshotsWorking: true,
    });

    expect(checklist).toEqual({
      readmeInstructions: true,
      testedWorking: true,
      usedAi: false,
      githubPublic: true,
      descriptionClear: false,
      screenshotsWorking: true,
      didNotManipulateHackatimeData: false,
      didNotCopyCodeWithoutAttribution: false,
    });
  });

  test("rejects non-boolean checklist values", () => {
    const checklist = parseProjectSubmissionChecklist({
      readmeInstructions: true,
      testedWorking: true,
      usedAi: "no",
      githubPublic: true,
      descriptionClear: true,
      screenshotsWorking: true,
    });

    expect(checklist).toBeNull();
  });
});

import { describe, expect, test } from "bun:test";

const { buildOnboardingSteps, countDoneSteps, isOnboardingComplete } = await import(
  "./onboarding-shared.ts"
);

function progress(overrides = {}) {
  return {
    hackatimeConnected: false,
    hasProject: false,
    hasDevlog: false,
    hasSubmittedProject: false,
    firstProjectId: null,
    ...overrides,
  };
}

describe("isOnboardingComplete", () => {
  test("false for a brand-new user", () => {
    expect(isOnboardingComplete(progress())).toBe(false);
  });

  test("true only when all three steps are done", () => {
    expect(
      isOnboardingComplete(
        progress({ hackatimeConnected: true, hasProject: true, hasDevlog: true }),
      ),
    ).toBe(true);
    expect(isOnboardingComplete(progress({ hackatimeConnected: true, hasProject: true }))).toBe(
      false,
    );
  });

  test("a submitted project short-circuits (legacy users without devlogs)", () => {
    expect(isOnboardingComplete(progress({ hasSubmittedProject: true }))).toBe(true);
  });
});

describe("buildOnboardingSteps", () => {
  test("orders hackatime -> project -> devlog and marks the first undone step as next", () => {
    const steps = buildOnboardingSteps(progress({ hackatimeConnected: true }));
    expect(steps.map((s) => s.key)).toEqual(["hackatime", "project", "devlog"]);
    expect(steps.map((s) => s.done)).toEqual([true, false, false]);
    expect(steps.map((s) => s.isNext)).toEqual([false, true, false]);
  });

  test("devlog step deep-links to the first project when one exists", () => {
    const withProject = buildOnboardingSteps(
      progress({ hasProject: true, firstProjectId: "proj 1" }),
    );
    expect(withProject[2].href).toBe("/projects/proj%201/devlogs/new");

    const withoutProject = buildOnboardingSteps(progress());
    expect(withoutProject[2].href).toBe("/projects");
  });

  test("countDoneSteps matches the done flags", () => {
    expect(countDoneSteps(progress())).toBe(0);
    expect(countDoneSteps(progress({ hackatimeConnected: true, hasDevlog: true }))).toBe(2);
  });
});

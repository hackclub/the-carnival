import type { ProjectSubmissionChecklist } from "@/db/schema";
import { REQUIRED_SUBMISSION_DECLARATIONS } from "@/lib/review/submission-gates";

export type ProjectSubmissionChecklistKey = keyof ProjectSubmissionChecklist;

export const EMPTY_PROJECT_SUBMISSION_CHECKLIST: ProjectSubmissionChecklist = {
  readmeInstructions: false,
  readmeDescribesProject: false,
  testedWorking: false,
  usedAi: false,
  githubPublic: false,
  descriptionClear: false,
  screenshotsWorking: false,
  worksOnDeclaredPlatform: false,
  didNotManipulateHackatimeData: false,
  didNotCopyCodeWithoutAttribution: false,
};

const BLOCKING_HELPER =
  "Required to submit for review. Reviewers verify this — an untrue declaration leads to rejection.";

// Every item except `usedAi` must be checked before a project can be
// submitted for review (enforced server-side by the submission gates in
// src/lib/review/submission-gates.ts). `usedAi` is a disclosure, not a
// promise: it must never be forced either way.
export const PROJECT_SUBMISSION_CHECKLIST_ITEMS: Array<{
  key: ProjectSubmissionChecklistKey;
  label: string;
  helper: string;
}> = [
  {
    key: "readmeDescribesProject",
    label: "My README clearly describes what the project is about",
    helper: `${BLOCKING_HELPER} An unclear README is an automatic rejection.`,
  },
  {
    key: "readmeInstructions",
    label: "My README contains clear instructions to set up, build, and run my project",
    helper: `${BLOCKING_HELPER} An unclear README is an automatic rejection.`,
  },
  {
    key: "testedWorking",
    label: "I have tested my project and it works without breaking",
    helper: BLOCKING_HELPER,
  },
  {
    key: "worksOnDeclaredPlatform",
    label: "My project installs and works on the platform I selected above",
    helper: BLOCKING_HELPER,
  },
  {
    key: "usedAi",
    label: "I used AI while building this",
    helper: "Disclose AI usage for reviewer context. Unchecked means you did not use AI.",
  },
  {
    key: "githubPublic",
    label: "The source code URL is publicly accessible for reviewers",
    helper: BLOCKING_HELPER,
  },
  {
    key: "descriptionClear",
    label: "The description clearly explains what the project is and what it does",
    helper: BLOCKING_HELPER,
  },
  {
    key: "screenshotsWorking",
    label: "I included screenshots of my project working (not my code)",
    helper: BLOCKING_HELPER,
  },
  {
    key: "didNotManipulateHackatimeData",
    label: "I did not manipulate Hackatime data to commit fraud",
    helper: BLOCKING_HELPER,
  },
  {
    key: "didNotCopyCodeWithoutAttribution",
    label: "I did not copy code from somewhere else without attribution",
    helper: BLOCKING_HELPER,
  },
];

export function isBlockingChecklistKey(key: ProjectSubmissionChecklistKey): boolean {
  return REQUIRED_SUBMISSION_DECLARATIONS.includes(key);
}

export function normalizeProjectSubmissionChecklist(
  value: Partial<ProjectSubmissionChecklist> | null | undefined,
): ProjectSubmissionChecklist {
  const definedValues = Object.fromEntries(
    Object.entries(value ?? {}).filter(([, itemValue]) => itemValue !== undefined),
  ) as Partial<ProjectSubmissionChecklist>;
  return {
    ...EMPTY_PROJECT_SUBMISSION_CHECKLIST,
    ...definedValues,
  };
}

export function parseProjectSubmissionChecklist(
  value: unknown,
): ProjectSubmissionChecklist | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const knownKeysAreBooleans = PROJECT_SUBMISSION_CHECKLIST_ITEMS.every(
    ({ key }) => row[key] === undefined || typeof row[key] === "boolean",
  );
  if (!knownKeysAreBooleans) return null;
  return normalizeProjectSubmissionChecklist(row as Partial<ProjectSubmissionChecklist>);
}

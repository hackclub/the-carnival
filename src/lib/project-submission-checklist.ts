import type { ProjectSubmissionChecklist } from "@/db/schema";

export type ProjectSubmissionChecklistKey = keyof ProjectSubmissionChecklist;

export const EMPTY_PROJECT_SUBMISSION_CHECKLIST: ProjectSubmissionChecklist = {
  readmeInstructions: false,
  testedWorking: false,
  usedAi: false,
  githubPublic: false,
  descriptionClear: false,
  screenshotsWorking: false,
  didNotManipulateHackatimeData: false,
  didNotCopyCodeWithoutAttribution: false,
};

export const PROJECT_SUBMISSION_CHECKLIST_ITEMS: Array<{
  key: ProjectSubmissionChecklistKey;
  label: string;
  helper: string;
}> = [
  {
    key: "readmeInstructions",
    label: "My README contains instructions to build and/or run my extension",
    helper: "Recorded for reviewer context. Unchecked answers are still saved.",
  },
  {
    key: "testedWorking",
    label: "I have tested my extension/plugin and it works without breaking",
    helper: "Recorded for reviewer context. Unchecked answers are still saved.",
  },
  {
    key: "usedAi",
    label: "I used AI while building this",
    helper: "Disclose AI usage for reviewer context. Unchecked means you did not use AI.",
  },
  {
    key: "githubPublic",
    label: "The GitHub URL is publicly accessible for reviewers",
    helper: "Recorded for reviewer context. Unchecked answers are still saved.",
  },
  {
    key: "descriptionClear",
    label: "The description clearly explains what the project is and what it does",
    helper: "Recorded for reviewer context. Unchecked answers are still saved.",
  },
  {
    key: "screenshotsWorking",
    label: "I included screenshots of my project working (not my code)",
    helper: "Recorded for reviewer context. Unchecked answers are still saved.",
  },
  {
    key: "didNotManipulateHackatimeData",
    label: "I did not manipulate Hackatime data to commit fraud",
    helper: "Recorded for reviewer context. Unchecked answers are still saved.",
  },
  {
    key: "didNotCopyCodeWithoutAttribution",
    label: "I did not copy code from somewhere else without attribution",
    helper: "Recorded for reviewer context. Unchecked answers are still saved.",
  },
];

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
  const normalized = normalizeProjectSubmissionChecklist({
    readmeInstructions: row.readmeInstructions as boolean,
    testedWorking: row.testedWorking as boolean,
    usedAi: row.usedAi as boolean,
    githubPublic: row.githubPublic as boolean,
    descriptionClear: row.descriptionClear as boolean,
    screenshotsWorking: row.screenshotsWorking as boolean,
    didNotManipulateHackatimeData: row.didNotManipulateHackatimeData as boolean,
    didNotCopyCodeWithoutAttribution: row.didNotCopyCodeWithoutAttribution as boolean,
  });
  const knownKeysAreBooleans = PROJECT_SUBMISSION_CHECKLIST_ITEMS.every(
    ({ key }) => row[key] === undefined || typeof row[key] === "boolean",
  );
  return knownKeysAreBooleans ? normalized : null;
}

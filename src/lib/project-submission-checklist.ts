import type { ProjectSubmissionChecklist } from "@/db/schema";

export type ProjectSubmissionChecklistKey = keyof ProjectSubmissionChecklist;

export const EMPTY_PROJECT_SUBMISSION_CHECKLIST: ProjectSubmissionChecklist = {
  readmeInstructions: false,
  testedWorking: false,
  usedAi: false,
  githubPublic: false,
  descriptionClear: false,
  screenshotsWorking: false,
};

export const PROJECT_SUBMISSION_CHECKLIST_ITEMS: Array<{
  key: ProjectSubmissionChecklistKey;
  label: string;
  helper: string;
  required: boolean;
}> = [
  {
    key: "readmeInstructions",
    label: "My README contains instructions to build and/or run my extension",
    helper: "Reviewers should be able to follow it and reproduce.",
    required: true,
  },
  {
    key: "testedWorking",
    label: "I have tested my extension/plugin and it works without breaking",
    helper: "You’re confident it’s stable enough for review.",
    required: true,
  },
  {
    key: "usedAi",
    label: "I used AI while building this",
    helper: "Optional disclosure to give reviewers extra context.",
    required: false,
  },
  {
    key: "githubPublic",
    label: "The GitHub URL is publicly accessible for reviewers",
    helper: "Private repos can’t be reviewed.",
    required: true,
  },
  {
    key: "descriptionClear",
    label: "The description clearly explains what the project is and what it does",
    helper: "Optional, but helps reviewers understand it quickly.",
    required: false,
  },
  {
    key: "screenshotsWorking",
    label: "I included screenshots of my project working (not my code)",
    helper: "Optional confirmation in addition to the required screenshot field.",
    required: false,
  },
];

export const REQUIRED_PROJECT_SUBMISSION_CHECKLIST_KEYS = PROJECT_SUBMISSION_CHECKLIST_ITEMS
  .filter((item) => item.required)
  .map((item) => item.key);

export function normalizeProjectSubmissionChecklist(
  value: Partial<ProjectSubmissionChecklist> | null | undefined,
): ProjectSubmissionChecklist {
  return {
    ...EMPTY_PROJECT_SUBMISSION_CHECKLIST,
    ...(value ?? {}),
  };
}

export function hasRequiredProjectSubmissionChecklistAnswers(
  checklist: ProjectSubmissionChecklist | null | undefined,
): boolean {
  if (!checklist) return false;
  return REQUIRED_PROJECT_SUBMISSION_CHECKLIST_KEYS.every((key) => checklist[key]);
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
  });
  const allBooleans = PROJECT_SUBMISSION_CHECKLIST_ITEMS.every(
    ({ key }) => typeof row[key] === "boolean",
  );
  return allBooleans ? normalized : null;
}

import Airtable from "airtable";

const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY! });

const base = airtable.base(process.env.AIRTABLE_BASE_ID!);

export default base;

export const AIRTABLE_GRANTS_TABLE_ENV = "AIRTABLE_GRANTS_TABLE";

// -----------------------------------------------------------------------------
// Airtable field schema (YSWS/Carnival-style submission record)
// -----------------------------------------------------------------------------
// Screenshots provided in the task. Anything prefixed "Automation" or "Loops"
// is intentionally excluded.

export const YSWS_AIRTABLE_FIELDS = {
  codeUrl: "Code URL",
  videoUrl: "Video URL",
  playableDemoUrl: "Playable Demo URL",

  howDidYouHearAboutThis: "How did you hear about this?",
  whatAreWeDoingWell: "What are we doing well?",
  howCanWeImprove: "How can we improve?",

  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  screenshot: "Screenshot",

  description: "Description",
  githubUsername: "GitHub Username",

  addressLine1: "Address (Line 1)",
  addressLine2: "Address (Line 2)",
  city: "City",
  stateProvince: "State / Province",
  country: "Country",
  zipPostalCode: "ZIP / Postal Code",

  birthday: "Birthday",

  overrideHoursSpent: "Optional - Override Hours Spent",
  overrideHoursSpentJustification: "Optional - Override Hours Spent Justification",

  slackId: "Slack ID",
  reviewStatus: "Review Status",
  reviewer: "Reviewer",
  hackatimeReviewLink: "Hackatime Review Link",
  submissionTime: "Submission Time",
} as const;

export type YswsAirtableFieldLabel = (typeof YSWS_AIRTABLE_FIELDS)[keyof typeof YSWS_AIRTABLE_FIELDS];

export type AirtableAttachment = {
  id?: string;
  url: string;
  filename?: string;
  type?: string;
  size?: number;
};

export type YswsSubmissionFields = {
  codeUrl: string | null;
  videoUrl: string | null;
  playableDemoUrl: string | null;

  howDidYouHearAboutThis: string | null;
  whatAreWeDoingWell: string | null;
  howCanWeImprove: string | null;

  firstName: string | null;
  lastName: string | null;
  email: string | null;
  screenshot: AirtableAttachment[] | null;

  description: string | null;
  githubUsername: string | null;

  birthday: string | null; // Airtable "Date" often arrives as an ISO string

  overrideHoursSpent: number | null;
  overrideHoursSpentJustification: string | null;

  slackId: string | null;
  reviewStatus: string | null;
  reviewer: string | null;
  hackatimeReviewLink: string | null;
  submissionTime: string | null; // Airtable "DateTime" often arrives as an ISO string
};

export type YswsProfileShippingFields = {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateProvince: string | null;
  country: string | null;
  zipPostalCode: string | null;
};

export type AirtableGrantCreateInput = {
  project: {
    name: string;
    description: string;
    codeUrl: string;
    videoUrl: string;
    playableDemoUrl: string;
    screenshots: string[];
    submittedAtIso: string | null;
    approvedHours: number | null;
  };
  creator: {
    name: string;
    email: string;
    slackId: string | null;
    birthdayIso?: string | null; // YYYY-MM-DD
  };
  shipping: YswsProfileShippingFields;
  hackatimeReviewLink?: string | null;
  reviewStatus?: string | null; // e.g. "Approved"
  reviewer?: string | null;
  reviews?: Array<{
    reviewerName: string;
    decision: "approved" | "rejected" | "comment";
    message: string;
  }>;
};

export type AirtableCreateResult = { id: string };

export type AirtableCreateErrorDetails = {
  message: string;
  statusCode?: number;
  airtableError?: string;
  hints: string[];
};

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toTrimmedStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s : null;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function isHttpUrlString(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function toHttpUrlOrNull(value: unknown): string | null {
  const s = toTrimmedStringOrNull(value);
  if (!s) return null;
  return isHttpUrlString(s) ? s : null;
}

function toAirtableAttachmentsOrNull(value: unknown): AirtableAttachment[] | null {
  if (!Array.isArray(value)) return null;
  const out: AirtableAttachment[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const url = toTrimmedStringOrNull(item.url);
    if (!url || !isHttpUrlString(url)) continue;
    const attachment: AirtableAttachment = { url };
    if (typeof item.id === "string") attachment.id = item.id;
    if (typeof item.filename === "string") attachment.filename = item.filename;
    if (typeof item.type === "string") attachment.type = item.type;
    if (typeof item.size === "number" && Number.isFinite(item.size)) attachment.size = item.size;
    out.push(attachment);
  }
  return out.length ? out : [];
}

function getField(fields: Record<string, unknown>, label: YswsAirtableFieldLabel): unknown {
  return fields[label];
}

function getGithubUsernameFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "github.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const username = parts[0]?.trim();
    return username ? username : null;
  } catch {
    return null;
  }
}

function splitFirstLastName(fullName: string): { firstName: string | null; lastName: string | null } {
  const cleaned = fullName.trim().replace(/\s+/g, " ");
  if (!cleaned) return { firstName: null, lastName: null };
  const parts = cleaned.split(" ");
  if (parts.length === 1) return { firstName: parts[0] ?? null, lastName: null };
  return { firstName: parts[0] ?? null, lastName: parts.slice(1).join(" ") || null };
}

export function getAirtableConfigErrors(env: NodeJS.ProcessEnv = process.env): string[] {
  const missing: string[] = [];
  if (!env.AIRTABLE_API_KEY) missing.push("AIRTABLE_API_KEY");
  if (!env.AIRTABLE_BASE_ID) missing.push("AIRTABLE_BASE_ID");
  if (!env[AIRTABLE_GRANTS_TABLE_ENV]) missing.push(AIRTABLE_GRANTS_TABLE_ENV);
  return missing;
}

export function toAirtableCreateErrorDetails(err: unknown): AirtableCreateErrorDetails {
  const hints: string[] = [];

  // Best-effort extraction for AirtableError (airtable.js exports it internally).
  const e = err as { message?: unknown; statusCode?: unknown; error?: unknown; toString?: unknown };
  const message =
    typeof e?.message === "string"
      ? e.message
      : typeof e?.toString === "function"
        ? String((e.toString as () => string)())
        : "Airtable request failed";

  const statusCode = typeof e?.statusCode === "number" ? e.statusCode : undefined;
  const airtableError = typeof e?.error === "string" ? e.error : undefined;

  if (statusCode === 401 || statusCode === 403) {
    hints.push("Check that AIRTABLE_API_KEY is correct and has access to the base.");
  }
  if (statusCode === 404) {
    hints.push(
      "Check that AIRTABLE_BASE_ID and AIRTABLE_GRANTS_TABLE are correct (base/table not found).",
    );
  }
  if (statusCode === 422) {
    hints.push("One or more field names don’t match the Airtable table schema.");
    hints.push("Double-check field types (attachments must be an array of {url}).");
  }
  if (statusCode === 429) {
    hints.push("Airtable rate limit hit; retry in a few seconds.");
  }
  if (!hints.length) {
    hints.push("Verify AIRTABLE_API_KEY, AIRTABLE_BASE_ID, and AIRTABLE_GRANTS_TABLE are set correctly.");
    hints.push("Verify the target table contains the expected fields (names must match exactly).");
  }

  return { message, statusCode, airtableError, hints };
}

export async function createAirtableGrantRecord(input: AirtableGrantCreateInput): Promise<AirtableCreateResult> {
  const missing = getAirtableConfigErrors(process.env);
  if (missing.length) {
    throw Object.assign(new Error(`Missing Airtable env vars: ${missing.join(", ")}`), {
      statusCode: 500,
      error: "missing_env",
      missing,
    });
  }

  const apiKey = process.env.AIRTABLE_API_KEY as string;
  const baseId = process.env.AIRTABLE_BASE_ID as string;
  const tableName = process.env[AIRTABLE_GRANTS_TABLE_ENV] as string;

  const client = new Airtable({ apiKey });
  const b = client.base(baseId);

  const ghUser = getGithubUsernameFromUrl(input.project.codeUrl);
  const { firstName, lastName } = splitFirstLastName(input.creator.name);

  const screenshotAttachments =
    Array.isArray(input.project.screenshots) && input.project.screenshots.length
      ? input.project.screenshots
          .filter((u) => typeof u === "string" && u.trim())
          .map((u) => u.trim())
          .map((url) => ({ url }))
      : [];

  // Only set fields when we have a value. This avoids Airtable type errors
  // (e.g. number fields receiving empty strings, collaborator fields receiving strings, etc).
  const fields: Record<string, unknown> = {};
  const setIf = (label: YswsAirtableFieldLabel, value: unknown) => {
    if (value === null || value === undefined) return;
    if (typeof value === "string" && value.trim() === "") return;
    fields[label] = value;
  };

  // Project
  setIf(YSWS_AIRTABLE_FIELDS.codeUrl, input.project.codeUrl);
  setIf(YSWS_AIRTABLE_FIELDS.videoUrl, input.project.videoUrl);
  setIf(YSWS_AIRTABLE_FIELDS.playableDemoUrl, input.project.playableDemoUrl);
  setIf(YSWS_AIRTABLE_FIELDS.description, input.project.description);
  if (screenshotAttachments.length) {
    fields[YSWS_AIRTABLE_FIELDS.screenshot] = screenshotAttachments;
  }
  // NOTE: Do not set "Submission Time" on create: it may be a computed field in Airtable.
  if (input.project.approvedHours !== null && input.project.approvedHours !== undefined) {
    setIf(YSWS_AIRTABLE_FIELDS.overrideHoursSpent, input.project.approvedHours);
  }

  // Creator (project user info)
  setIf(YSWS_AIRTABLE_FIELDS.firstName, firstName);
  setIf(YSWS_AIRTABLE_FIELDS.lastName, lastName);
  setIf(YSWS_AIRTABLE_FIELDS.email, input.creator.email);
  setIf(YSWS_AIRTABLE_FIELDS.slackId, input.creator.slackId);
  setIf(YSWS_AIRTABLE_FIELDS.githubUsername, ghUser);
  setIf(YSWS_AIRTABLE_FIELDS.birthday, input.creator.birthdayIso ?? null);

  // Shipping/profile (project user profile)
  setIf(YSWS_AIRTABLE_FIELDS.addressLine1, input.shipping.addressLine1);
  setIf(YSWS_AIRTABLE_FIELDS.addressLine2, input.shipping.addressLine2);
  setIf(YSWS_AIRTABLE_FIELDS.city, input.shipping.city);
  setIf(YSWS_AIRTABLE_FIELDS.stateProvince, input.shipping.stateProvince);
  setIf(YSWS_AIRTABLE_FIELDS.country, input.shipping.country);
  setIf(YSWS_AIRTABLE_FIELDS.zipPostalCode, input.shipping.zipPostalCode);

  // Review metadata (optional; omit collaborator-ish fields like Reviewer unless you know the Airtable type)
  setIf(YSWS_AIRTABLE_FIELDS.reviewStatus, input.reviewStatus ?? "Need Review");
  if (input.hackatimeReviewLink) {
    setIf(YSWS_AIRTABLE_FIELDS.hackatimeReviewLink, input.hackatimeReviewLink);
  }

  // Hours justification (structured text)
  const decisionLabel = (d: "approved" | "rejected" | "comment") =>
    d === "approved" ? "Approved" : d === "rejected" ? "Rejected" : "Comment";
  const reviewBlocks =
    input.reviews?.length
      ? input.reviews
          .map((r) => {
            const who = (r.reviewerName || "Unknown").trim() || "Unknown";
            const msg = (r.message || "").trim();
            return `Review by ${who} (${decisionLabel(r.decision)})\n${msg || "—"}`;
          })
          .join("\n\n")
      : "—";

  const hoursJustification = [`Hackatime reviewed: ✅`, ``, `Review comments`, ``, reviewBlocks].join("\n");
  setIf(YSWS_AIRTABLE_FIELDS.overrideHoursSpentJustification, hoursJustification);

  // Airtable's FieldSet types are intentionally loose, but TS treats `unknown` as too strict.
  // Cast to `any` for the library boundary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const record = (await (b(tableName) as any).create(fields as any, { typecast: true })) as { id: string };
  return { id: record.id };
}

/**
 * Validate and normalize an Airtable record `fields` object into a stable shape.
 * Pass the object you get from Airtable's API (typically `record.fields`).
 */
export function validateYswsSubmissionFields(fields: unknown): ValidationResult<YswsSubmissionFields> {
  if (!isRecord(fields)) {
    return { success: false, errors: ["Expected Airtable fields to be an object."] };
  }

  const errors: string[] = [];

  const codeUrl = toHttpUrlOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.codeUrl));
  const videoUrl = toHttpUrlOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.videoUrl));
  const playableDemoUrl = toHttpUrlOrNull(
    getField(fields, YSWS_AIRTABLE_FIELDS.playableDemoUrl),
  );
  const hackatimeReviewLink = toHttpUrlOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.hackatimeReviewLink));

  // URL fields: if present but invalid, report it.
  const rawCodeUrl = toTrimmedStringOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.codeUrl));
  if (rawCodeUrl && !codeUrl) errors.push(`"${YSWS_AIRTABLE_FIELDS.codeUrl}" must be an http(s) URL.`);

  const rawVideoUrl = toTrimmedStringOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.videoUrl));
  if (rawVideoUrl && !videoUrl)
    errors.push(`"${YSWS_AIRTABLE_FIELDS.videoUrl}" must be an http(s) URL.`);

  const rawPlayableDemoUrl = toTrimmedStringOrNull(
    getField(fields, YSWS_AIRTABLE_FIELDS.playableDemoUrl),
  );
  if (rawPlayableDemoUrl && !playableDemoUrl)
    errors.push(`"${YSWS_AIRTABLE_FIELDS.playableDemoUrl}" must be an http(s) URL.`);

  const rawHackatimeReviewLink = toTrimmedStringOrNull(
    getField(fields, YSWS_AIRTABLE_FIELDS.hackatimeReviewLink),
  );
  if (rawHackatimeReviewLink && !hackatimeReviewLink)
    errors.push(`"${YSWS_AIRTABLE_FIELDS.hackatimeReviewLink}" must be an http(s) URL.`);

  const screenshot = toAirtableAttachmentsOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.screenshot));
  const rawScreenshot = getField(fields, YSWS_AIRTABLE_FIELDS.screenshot);
  if (rawScreenshot !== undefined && rawScreenshot !== null && screenshot === null) {
    errors.push(`"${YSWS_AIRTABLE_FIELDS.screenshot}" must be an array of attachment objects.`);
  }

  const overrideHoursSpent = toNumberOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.overrideHoursSpent));
  const rawOverrideHours = getField(fields, YSWS_AIRTABLE_FIELDS.overrideHoursSpent);
  if (
    rawOverrideHours !== undefined &&
    rawOverrideHours !== null &&
    rawOverrideHours !== "" &&
    overrideHoursSpent === null
  ) {
    errors.push(`"${YSWS_AIRTABLE_FIELDS.overrideHoursSpent}" must be a number.`);
  }

  const data: YswsSubmissionFields = {
    codeUrl,
    videoUrl,
    playableDemoUrl,

    howDidYouHearAboutThis: toTrimmedStringOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.howDidYouHearAboutThis)),
    whatAreWeDoingWell: toTrimmedStringOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.whatAreWeDoingWell)),
    howCanWeImprove: toTrimmedStringOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.howCanWeImprove)),

    firstName: toTrimmedStringOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.firstName)),
    lastName: toTrimmedStringOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.lastName)),
    email: toTrimmedStringOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.email)),
    screenshot,

    description: toTrimmedStringOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.description)),
    githubUsername: toTrimmedStringOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.githubUsername)),

    birthday: toTrimmedStringOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.birthday)),

    overrideHoursSpent,
    overrideHoursSpentJustification: toTrimmedStringOrNull(
      getField(fields, YSWS_AIRTABLE_FIELDS.overrideHoursSpentJustification),
    ),

    slackId: toTrimmedStringOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.slackId)),
    reviewStatus: toTrimmedStringOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.reviewStatus)),
    reviewer: toTrimmedStringOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.reviewer)),
    hackatimeReviewLink,
    submissionTime: toTrimmedStringOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.submissionTime)),
  };

  if (errors.length) return { success: false, errors };
  return { success: true, data };
}

/**
 * Shipping/profile fields live on the user profile (not per-project).
 * Pass Airtable's `record.fields` to extract and normalize shipping values.
 */
export function validateYswsProfileShippingFields(
  fields: unknown,
): ValidationResult<YswsProfileShippingFields> {
  if (!isRecord(fields)) {
    return { success: false, errors: ["Expected Airtable fields to be an object."] };
  }

  const data: YswsProfileShippingFields = {
    addressLine1: toTrimmedStringOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.addressLine1)),
    addressLine2: toTrimmedStringOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.addressLine2)),
    city: toTrimmedStringOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.city)),
    stateProvince: toTrimmedStringOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.stateProvince)),
    country: toTrimmedStringOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.country)),
    zipPostalCode: toTrimmedStringOrNull(getField(fields, YSWS_AIRTABLE_FIELDS.zipPostalCode)),
  };

  return { success: true, data };
}

import Airtable from "airtable";
import {
  REVIEW_DEFLATION_REASON_OPTIONS,
  REVIEW_EVIDENCE_ITEMS,
  type ReviewJustificationPayload,
} from "@/lib/review-rules";

export const AIRTABLE_GRANTS_TABLE_ENV = "AIRTABLE_GRANTS_TABLE";

// -----------------------------------------------------------------------------
// Airtable field schema (YSWS/Carnival-style submission record)
// -----------------------------------------------------------------------------
// Screenshots provided in the task. Anything prefixed "Automation" or "Loops"
// is intentionally excluded.

export const YSWS_AIRTABLE_FIELDS = {
  codeUrl: "Code URL",
  videoUrl: "Video URL",
  playableDemoUrl: "Playable URL",

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
    id: string;
    name: string;
    description: string;
    hackatimeProjectName: string;
    codeUrl: string;
    videoUrl: string;
    playableDemoUrl: string;
    screenshots: string[];
    submittedAtIso: string | null;
    approvedHours: number | null;
    approvedAtIso: string | null;
  };
  creator: {
    name: string;
    email: string;
    slackId: string | null;
    birthdayIso?: string | null; // YYYY-MM-DD
    hackatimeUserId: string | null;
  };
  shipping: YswsProfileShippingFields;
  appUrl?: string | null;
  hackatimeReviewLink?: string | null;
  reviewStatus?: string | null; // e.g. "Approved"
  reviewer?: string | null;
  reviews?: AirtableGrantReview[];
  /**
   * The final human-written "Specific Technical Features" justification
   * (YSWS Handbook), confirmed by the granting admin at pass 2. Required for
   * the grant push — the justification is not spot-check-proof without it.
   */
  technicalJustification?: string | null;
  /** Every Hackatime project linked to this Carnival project. */
  hackatimeProjectNames?: string[];
  /**
   * Per-devlog assessments from the latest approved review. Deflation is
   * tied to time ranges: each reduced/rejected devlog renders its own
   * deflation line (range, logged → approved, reasons, note, verification
   * links) in the justification — there is no generic deflation summary.
   */
  devlogAssessments?: AirtableDevlogDeflationEntry[];
  /**
   * PREVIEW push: the record is clearly marked so nobody processes it —
   * "[PREVIEW]" is prepended to the Code URL (the first thing seen on the
   * record), Review Status is left BLANK (never "Approved"; it's a
   * single-select, so no new option is invented), and the justification
   * carries a banner line. Granting later overwrites the same record with
   * the real, unmarked payload.
   */
  preview?: boolean;
};

export type AirtableDevlogDeflationEntry = {
  title: string;
  startIso: string;
  endIso: string;
  loggedSeconds: number;
  approvedSeconds: number;
  decision: "accepted" | "rejected" | "adjusted";
  /** Keys from REVIEW_DEFLATION_REASON_OPTIONS. */
  deflationReasons: string[];
  note: string | null;
  /**
   * Reviewer-overridden considered window (trimmed inside the devlog's own
   * range, e.g. to exclude time already counted by an overlapping devlog).
   * When set, the justification shows THIS window as the considered one and
   * reviewedWindowSeconds is the server-verified Hackatime pull for it.
   */
  reviewedStartIso: string | null;
  reviewedEndIso: string | null;
  reviewedWindowSeconds: number | null;
  /** joe.fraud link scoped to the window actually considered. */
  hackatimeReviewUrl: string | null;
  devlogUrl: string | null;
};

export type AirtableGrantReview = {
  reviewerName: string;
  decision: "approved" | "rejected" | "comment";
  message: string;
  createdAtIso?: string | null;
  reviewJustification?: ReviewJustificationPayload | null;
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

const DEFLATION_REASON_LABELS = new Map<string, string>(
  REVIEW_DEFLATION_REASON_OPTIONS.map((option) => [option.key, option.label]),
);

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

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function buildProjectUrls(appUrl: string | null | undefined, projectId: string | null | undefined) {
  const base = appUrl ? trimTrailingSlash(appUrl.trim()) : "";
  if (!base || !projectId) {
    return { projectPage: null, devlogs: null, reviewComments: null };
  }
  const id = encodeURIComponent(projectId);
  const projectPage = `${base}/projects/${id}`;
  return {
    projectPage,
    devlogs: `${base}/projects/${id}/devlogs`,
    reviewComments: projectPage,
  };
}

function pickLatestApprovedReview(reviews: AirtableGrantReview[]) {
  const approved = reviews.filter((r) => r.decision === "approved");
  if (approved.length === 0) return null;
  return approved.reduce((latest, candidate) => {
    if (!latest) return candidate;
    const latestAt = latest.createdAtIso ? Date.parse(latest.createdAtIso) : Number.NEGATIVE_INFINITY;
    const candidateAt = candidate.createdAtIso
      ? Date.parse(candidate.createdAtIso)
      : Number.NEGATIVE_INFINITY;
    return candidateAt >= latestAt ? candidate : latest;
  }, null as AirtableGrantReview | null);
}

function formatLinkLine(label: string, url: string | null | undefined) {
  return `- ${label}: ${url && url.trim() ? url.trim() : "—"}`;
}

function formatHoursAwarded(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return Number.isInteger(value) ? `${value}h` : `${value.toFixed(1)}h`;
}

/** Handbook date format for justification ranges: M/D/YYYY (e.g. 7/20/2026). */
function formatHandbookDate(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!match) return null;
  return `${Number(match[2])}/${Number(match[3])}/${match[1]}`;
}

export type AirtableJustificationContext = {
  projectId?: string | null;
  appUrl?: string | null;
  codeUrl?: string | null;
  hackatimeUserId?: string | null;
  approvedHours?: number | null;
  approvedAtIso?: string | null;
  technicalJustification?: string | null;
  hackatimeProjectNames?: string[];
  hackatimeReviewLink?: string | null;
  devlogAssessments?: AirtableDevlogDeflationEntry[];
};

function formatSecondsAsHours(seconds: number): string {
  return `${(Math.max(0, seconds) / 3600).toFixed(1)}h`;
}

/**
 * Assemble the "Optional - Override Hours Spent Justification" text.
 *
 * The structure mirrors the YSWS Handbook's Justification Fields, in order:
 *   1. Hackatime Project Name(s) and Date Range(s) — automated, in the
 *      handbook's comma-separated "name M/D/YYYY-M/D/YYYY" format.
 *   2. Submitter Hackatime ID — automated.
 *   3. Specific Technical Features — human-written (pass-1 reviewer drafts,
 *      granting admin finalizes). Always required.
 *   4. Deflation Justification — human-written, "Deflated from X to Y
 *      because ..." with the numbers filled in automatically.
 *   5. Additional Justification — evidence checklist, review links
 *      (joe.fraud, Carnival project/devlog pages), reviewer, approval time —
 *      everything a spot-checker needs to retrace the review.
 *
 * The standard (per the handbook): someone not involved in the review must be
 * able to read this, follow the links, and reach the same conclusion.
 * This text is internal — the submitter never sees it.
 */
export function formatAirtableHoursJustification(
  reviews: AirtableGrantReview[] | undefined,
  context?: AirtableJustificationContext,
) {
  const ctx = context ?? {};
  const latestApproved = pickLatestApprovedReview(reviews ?? []);
  const justification = latestApproved?.reviewJustification ?? null;
  const urls = buildProjectUrls(ctx.appUrl ?? null, ctx.projectId ?? null);

  const sections: string[] = [];

  // 1. Hackatime Project Name(s) and Date Range(s)
  const rangeStart = formatHandbookDate(justification?.reviewDateRange.startDate);
  const rangeEnd = formatHandbookDate(justification?.reviewDateRange.endDate);
  const rangeLabel = rangeStart && rangeEnd ? `${rangeStart}-${rangeEnd}` : null;
  const projectNames =
    ctx.hackatimeProjectNames && ctx.hackatimeProjectNames.length > 0
      ? ctx.hackatimeProjectNames
      : justification?.hackatimeProjectName
        ? [justification.hackatimeProjectName]
        : [];
  const namesWithRanges =
    projectNames.length > 0
      ? projectNames.map((name) => (rangeLabel ? `${name} ${rangeLabel}` : name)).join(", ")
      : "—";
  sections.push(["[HACKATIME PROJECT NAME(S) AND DATE RANGE(S)]", namesWithRanges].join("\n"));

  // 2. Submitter Hackatime ID
  sections.push(["[SUBMITTER HACKATIME ID]", ctx.hackatimeUserId?.trim() || "—"].join("\n"));

  // 3. Specific Technical Features (human-written)
  sections.push(
    ["[SPECIFIC TECHNICAL FEATURES]", ctx.technicalJustification?.trim() || "—"].join("\n"),
  );

  // 4. Deflation Justification — per devlog, tied to each time range.
  // Every reduced/rejected devlog renders its own line: window, logged →
  // approved, the reviewer's reasons and note, and verification links
  // (joe.fraud scoped to the window + the devlog page), so a spot-checker
  // can retrace every individual reduction. Reviews recorded before
  // per-devlog deflation fall back to the legacy project-level fields.
  const deflationLines: string[] = ["[DEFLATION JUSTIFICATION]"];
  const assessments = ctx.devlogAssessments ?? [];
  if (assessments.length > 0) {
    const loggedTotal = assessments.reduce((acc, a) => acc + a.loggedSeconds, 0);
    const approvedLabel = formatHoursAwarded(ctx.approvedHours ?? null);
    deflationLines.push(
      `Logged ${formatSecondsAsHours(loggedTotal)} across the reviewed devlogs; ${approvedLabel} approved.`,
    );
    for (const entry of assessments) {
      const originalRange = `${formatHandbookDate(entry.startIso) ?? entry.startIso}-${formatHandbookDate(entry.endIso) ?? entry.endIso}`;
      // When the reviewer overrode the considered window (e.g. trimming days
      // an overlapping devlog already covered), the justification names THAT
      // window as the one considered, with the original noted alongside.
      const hasReviewedWindow = !!(entry.reviewedStartIso && entry.reviewedEndIso);
      const reviewedRange = hasReviewedWindow
        ? `${formatHandbookDate(entry.reviewedStartIso!) ?? entry.reviewedStartIso}-${formatHandbookDate(entry.reviewedEndIso!) ?? entry.reviewedEndIso}`
        : null;
      const rangeLabel = hasReviewedWindow
        ? `considered ${reviewedRange}, trimmed from ${originalRange}`
        : originalRange;
      const header = `- "${entry.title}" (${rangeLabel}):`;
      // Sub-minute differences are rounding from the reviewer's hour/minute
      // inputs, not deflation (mirrors assessmentDeflatesHours' tolerance).
      if (
        entry.decision !== "rejected" &&
        entry.loggedSeconds - entry.approvedSeconds <= 59
      ) {
        deflationLines.push(
          `${header} accepted as logged (${formatSecondsAsHours(entry.loggedSeconds)}).`,
        );
        continue;
      }
      const windowNote =
        hasReviewedWindow && typeof entry.reviewedWindowSeconds === "number"
          ? ` Hackatime in the considered window: ${formatSecondsAsHours(entry.reviewedWindowSeconds)}.`
          : "";
      const outcome =
        entry.decision === "rejected"
          ? `rejected — logged ${formatSecondsAsHours(entry.loggedSeconds)}, 0.0h approved`
          : `deflated from ${formatSecondsAsHours(entry.loggedSeconds)} to ${formatSecondsAsHours(entry.approvedSeconds)}`;
      const reasons = entry.deflationReasons
        .map((reason) => DEFLATION_REASON_LABELS.get(reason) ?? reason)
        .join(", ");
      const parts = [
        `${header} ${outcome}.${windowNote}`,
        `Reasons: ${reasons || "—"}.`,
        entry.note ? `Note: ${entry.note}` : null,
        entry.hackatimeReviewUrl
          ? `Hackatime (considered range): ${entry.hackatimeReviewUrl}`
          : null,
        entry.devlogUrl ? `Devlog: ${entry.devlogUrl}` : null,
      ].filter(Boolean);
      deflationLines.push(parts.join(" "));
    }
  } else if (justification?.deflation.reduced) {
    // Legacy reviews (pre per-devlog deflation): the old project-level fields.
    const approved = ctx.approvedHours ?? null;
    const tracked =
      approved !== null && Number.isFinite(approved)
        ? approved + justification.deflation.hoursReducedBy
        : null;
    deflationLines.push(
      `Deflated from ${formatHoursAwarded(tracked)} to ${formatHoursAwarded(approved)}.`,
    );
    const reasons = justification.deflation.reasons
      .map((reason) => DEFLATION_REASON_LABELS.get(reason) ?? reason)
      .join(", ");
    deflationLines.push(`- Reasons: ${reasons || "—"}`);
    deflationLines.push(`- Reviewer note: ${justification.deflation.note ?? "—"}`);
  } else {
    deflationLines.push("No deflation — hours approved as tracked.");
  }
  sections.push(deflationLines.join("\n"));

  // 5. Additional Justification (evidence + verifiable links)
  const additionalLines: string[] = ["[ADDITIONAL JUSTIFICATION]"];
  additionalLines.push(`- Hours awarded: ${formatHoursAwarded(ctx.approvedHours ?? null)}`);
  if (justification) {
    const confirmed = REVIEW_EVIDENCE_ITEMS.filter((item) => justification.evidence[item.key]);
    const unconfirmed = REVIEW_EVIDENCE_ITEMS.filter((item) => !justification.evidence[item.key]);
    additionalLines.push(
      `- Reviewer evidence confirmed: ${confirmed.map((i) => i.label).join("; ") || "none"}`,
    );
    if (unconfirmed.length > 0) {
      additionalLines.push(`- NOT confirmed: ${unconfirmed.map((i) => i.label).join("; ")}`);
    }
  } else {
    additionalLines.push("- Structured review confirmation: unavailable");
  }
  additionalLines.push(formatLinkLine("Hackatime review (joe.fraud)", ctx.hackatimeReviewLink));
  additionalLines.push(formatLinkLine("Carnival project page", urls.projectPage));
  additionalLines.push(formatLinkLine("Devlogs", urls.devlogs));
  additionalLines.push(formatLinkLine("Source repository", ctx.codeUrl ?? null));
  const approvedAt = ctx.approvedAtIso ?? latestApproved?.createdAtIso ?? null;
  additionalLines.push(`- Reviewed by: ${latestApproved?.reviewerName ?? "—"}`);
  additionalLines.push(`- Approved at: ${approvedAt ?? "—"}`);
  sections.push(additionalLines.join("\n"));

  return sections.join("\n\n");
}

export function getAirtableConfigErrors(env: NodeJS.ProcessEnv = process.env): string[] {
  const missing: string[] = [];
  if (!env.AIRTABLE_API_KEY) missing.push("AIRTABLE_API_KEY");
  if (!env.AIRTABLE_BASE_ID) missing.push("AIRTABLE_BASE_ID");
  if (!env[AIRTABLE_GRANTS_TABLE_ENV]) missing.push(AIRTABLE_GRANTS_TABLE_ENV);
  return missing;
}

function getAirtableBase(env: NodeJS.ProcessEnv = process.env) {
  const apiKey = env.AIRTABLE_API_KEY;
  const baseId = env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    const missing: string[] = [];
    if (!apiKey) missing.push("AIRTABLE_API_KEY");
    if (!baseId) missing.push("AIRTABLE_BASE_ID");

    throw Object.assign(new Error(`Missing Airtable env vars: ${missing.join(", ")}`), {
      statusCode: 500,
      error: "missing_env",
      missing,
    });
  }

  return new Airtable({ apiKey }).base(baseId);
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

/**
 * Build the exact Airtable `fields` object for a grant record. This is the
 * single source of truth used by create, update, AND the admin's pre-grant
 * payload preview — so what the admin sees is byte-for-byte what gets sent.
 */
export function buildAirtableGrantFields(input: AirtableGrantCreateInput): Record<string, unknown> {
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

  const isPreview = input.preview === true;

  // Project. The demo video URL is deliberately NOT sent: it is a
  // Carnival-side review requirement, not a Unified Database field.
  // Preview pushes prepend [PREVIEW] to the Code URL — the first thing an
  // admin sees on the record — so it is unmistakably a dry run that must not
  // be pushed on to the main database. (Kept out of single-select fields:
  // typecast can't create new select options without schema permissions.)
  setIf(
    YSWS_AIRTABLE_FIELDS.codeUrl,
    isPreview ? `[PREVIEW] ${input.project.codeUrl}` : input.project.codeUrl,
  );
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
  // Review Status is a single-select in Airtable: typecast cannot invent new
  // options without schema permissions, so previews simply OMIT the field —
  // a blank status can never be read as "Approved" downstream.
  if (!isPreview) {
    setIf(YSWS_AIRTABLE_FIELDS.reviewStatus, input.reviewStatus ?? "Need Review");
  }
  if (input.hackatimeReviewLink) {
    setIf(YSWS_AIRTABLE_FIELDS.hackatimeReviewLink, input.hackatimeReviewLink);
  }

  // Hours justification (handbook-structured text; see formatAirtableHoursJustification)
  const hoursJustification = formatAirtableHoursJustification(input.reviews, {
    projectId: input.project.id,
    appUrl: input.appUrl ?? null,
    codeUrl: input.project.codeUrl,
    hackatimeUserId: input.creator.hackatimeUserId,
    approvedHours: input.project.approvedHours,
    approvedAtIso: input.project.approvedAtIso,
    technicalJustification: input.technicalJustification ?? null,
    hackatimeProjectNames: input.hackatimeProjectNames ?? [],
    hackatimeReviewLink: input.hackatimeReviewLink ?? null,
    devlogAssessments: input.devlogAssessments ?? [],
  });
  setIf(
    YSWS_AIRTABLE_FIELDS.overrideHoursSpentJustification,
    isPreview
      ? `[PREVIEW PUSH — NOT A GRANT. This record will be overwritten by the real grant or deleted.]\n\n${hoursJustification}`
      : hoursJustification,
  );

  return fields;
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

  const tableName = process.env[AIRTABLE_GRANTS_TABLE_ENV] as string;
  const b = getAirtableBase(process.env);
  const fields = buildAirtableGrantFields(input);

  // Airtable's FieldSet types are intentionally loose, but TS treats `unknown` as too strict.
  // Cast to `any` for the library boundary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const record = (await (b(tableName) as any).create(fields as any, { typecast: true })) as { id: string };
  return { id: record.id };
}

/**
 * Update the existing Airtable record for a project (idempotent re-push).
 * The stored record id (project.airtable_record_id) makes "Push to Airtable"
 * an UPDATE by default — duplicates only happen through the explicit
 * "create another record" escape hatch on the grant page.
 */
export async function updateAirtableGrantRecord(
  recordId: string,
  input: AirtableGrantCreateInput,
): Promise<AirtableCreateResult> {
  const missing = getAirtableConfigErrors(process.env);
  if (missing.length) {
    throw Object.assign(new Error(`Missing Airtable env vars: ${missing.join(", ")}`), {
      statusCode: 500,
      error: "missing_env",
      missing,
    });
  }

  const tableName = process.env[AIRTABLE_GRANTS_TABLE_ENV] as string;
  const b = getAirtableBase(process.env);
  const fields = buildAirtableGrantFields(input);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const record = (await (b(tableName) as any).update(recordId, fields as any, {
    typecast: true,
  })) as { id: string };
  return { id: record.id };
}

/**
 * Delete an Airtable grant record. Used ONLY to clean up [PREVIEW]-marked
 * records when a previewed project is sent back to review instead of being
 * granted — real grant records are never deleted through this path.
 */
export async function deleteAirtableGrantRecord(recordId: string): Promise<void> {
  const missing = getAirtableConfigErrors(process.env);
  if (missing.length) {
    throw Object.assign(new Error(`Missing Airtable env vars: ${missing.join(", ")}`), {
      statusCode: 500,
      error: "missing_env",
      missing,
    });
  }

  const tableName = process.env[AIRTABLE_GRANTS_TABLE_ENV] as string;
  const b = getAirtableBase(process.env);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (b(tableName) as any).destroy(recordId);
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

/**
 * PASS 2 — grant-time context and Airtable payload assembly.
 *
 * Everything the granting admin's endpoints need to build the Unified
 * Database record lives here, so the grant action, the manual "Push to
 * Airtable" action, and the pre-grant payload PREVIEW all run the exact same
 * code path: what the admin previews is what gets sent.
 *
 * Flow recap (two-pass review):
 *   pass 1 — a reviewer approves in the review queue → project.status =
 *            "shipped", NO notification to the creator.
 *   pass 2 — an admin re-reviews everything on the grant page, writes/edits
 *            the human "Specific Technical Features" justification, previews
 *            the payload, and grants → Airtable record + tokens + the ONLY
 *            "approved" notification the creator ever receives.
 */

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  devlog,
  peerReview,
  peerReviewDevlogAssessment,
  project,
  user,
  type ReviewDecision,
} from "@/db/schema";
import {
  buildAirtableGrantFields,
  formatAirtableHoursJustification,
  type AirtableDevlogDeflationEntry,
  type AirtableGrantCreateInput,
} from "@/lib/airtable";
import { buildHackatimeDevlogReviewUrls, buildJoeFraudUrl } from "@/lib/constants";
import { listProjectHackatimeProjects } from "@/lib/devlogs";
import { hydrateReviewJustification } from "@/lib/review-justification";

export type IdentityGrantProfile = {
  name: string | null;
  email: string | null;
  slackId: string | null;
  birthday: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateProvince: string | null;
  country: string | null;
  zipPostalCode: string | null;
};

const EMPTY_IDENTITY_GRANT_PROFILE: IdentityGrantProfile = {
  name: null,
  email: null,
  slackId: null,
  birthday: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  stateProvince: null,
  country: null,
  zipPostalCode: null,
};

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toIsoDateOnlyOrNull(value: unknown): string | null {
  const raw = toNullableString(value);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function getAddressSource(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;

  if (root.address && typeof root.address === "object" && !Array.isArray(root.address)) {
    return root.address as Record<string, unknown>;
  }

  if (Array.isArray(root.addresses)) {
    const primary = root.addresses.find((a) => {
      if (!a || typeof a !== "object" || Array.isArray(a)) return false;
      const row = a as { primary?: unknown };
      return row.primary === true;
    });
    const first =
      primary ?? root.addresses.find((a) => a && typeof a === "object" && !Array.isArray(a));
    if (first && typeof first === "object") return first as Record<string, unknown>;
  }

  return root;
}

export function parseIdentityGrantProfile(payload: unknown): IdentityGrantProfile {
  const out: IdentityGrantProfile = { ...EMPTY_IDENTITY_GRANT_PROFILE };

  if (!payload || typeof payload !== "object") return out;
  const root = payload as Record<string, unknown>;
  const identity =
    root.identity && typeof root.identity === "object" && !Array.isArray(root.identity)
      ? (root.identity as Record<string, unknown>)
      : root;

  const firstName = toNullableString(identity.first_name ?? identity.firstName);
  const lastName = toNullableString(identity.last_name ?? identity.lastName);
  const legalFirstName = toNullableString(identity.legal_first_name ?? identity.legalFirstName);
  const legalLastName = toNullableString(identity.legal_last_name ?? identity.legalLastName);

  const joined = [firstName, lastName].filter((p): p is string => !!p).join(" ").trim();
  const legalJoined = [legalFirstName, legalLastName]
    .filter((p): p is string => !!p)
    .join(" ")
    .trim();
  out.name = joined || legalJoined || null;
  out.email = toNullableString(identity.primary_email ?? identity.email);
  out.slackId = toNullableString(identity.slack_id ?? identity.slackId);

  out.birthday = toIsoDateOnlyOrNull(
    identity.birthday ?? identity.birthdate ?? identity.date_of_birth ?? identity.dob,
  );

  const address = getAddressSource(identity);
  if (!address) return out;

  out.addressLine1 = toNullableString(
    address.line_1 ??
      address.address_line_1 ??
      address.addressLine1 ??
      address.line1 ??
      address.street_1,
  );
  out.addressLine2 = toNullableString(
    address.line_2 ??
      address.address_line_2 ??
      address.addressLine2 ??
      address.line2 ??
      address.street_2,
  );
  out.city = toNullableString(address.city ?? address.locality ?? address.town);
  out.stateProvince = toNullableString(
    address.state ?? address.state_province ?? address.stateProvince ?? address.region,
  );
  out.country = toNullableString(address.country ?? address.country_code ?? address.countryCode);
  out.zipPostalCode = toNullableString(
    address.postal_code ?? address.zip_postal_code ?? address.zipPostalCode ?? address.postcode,
  );

  return out;
}

/**
 * Creator identity is re-fetched live from Hack Club Identity at grant time
 * and takes precedence over locally stored values, so the Unified Database
 * always receives the freshest legal name/address.
 */
export async function fetchIdentityGrantProfile(
  identityToken: string | null,
): Promise<IdentityGrantProfile> {
  if (!identityToken) return EMPTY_IDENTITY_GRANT_PROFILE;

  const identityHost = process.env.HC_IDENTITY_HOST ?? "https://auth.hackclub.com";
  if (!identityHost) return EMPTY_IDENTITY_GRANT_PROFILE;

  try {
    const res = await fetch(`${identityHost}/api/v1/me`, {
      headers: { Authorization: `Bearer ${identityToken}` },
      cache: "no-store",
    });
    if (!res.ok) return EMPTY_IDENTITY_GRANT_PROFILE;
    const raw = (await res.json().catch(() => null)) as unknown;
    return parseIdentityGrantProfile(raw);
  } catch {
    return EMPTY_IDENTITY_GRANT_PROFILE;
  }
}

type AirtableGrantReview = NonNullable<AirtableGrantCreateInput["reviews"]>[number];

type GrantReviewRow = {
  reviewerName: string | null;
  decision: ReviewDecision;
  reviewComment: string;
  reviewEvidenceChecklist: unknown;
  reviewedHackatimeRangeStart: Date | null;
  reviewedHackatimeRangeEnd: Date | null;
  hourAdjustmentReasonMetadata: unknown;
  createdAt: Date;
};

export async function loadGrantReviewsForAirtable(
  projectId: string,
  fallbackHackatimeProjectName: string,
): Promise<AirtableGrantReview[]> {
  const rows = (await db
    .select({
      decision: peerReview.decision,
      reviewComment: peerReview.reviewComment,
      reviewerName: user.name,
      reviewEvidenceChecklist: peerReview.reviewEvidenceChecklist,
      reviewedHackatimeRangeStart: peerReview.reviewedHackatimeRangeStart,
      reviewedHackatimeRangeEnd: peerReview.reviewedHackatimeRangeEnd,
      hourAdjustmentReasonMetadata: peerReview.hourAdjustmentReasonMetadata,
      createdAt: peerReview.createdAt,
    })
    .from(peerReview)
    .leftJoin(user, eq(peerReview.reviewerId, user.id))
    .where(eq(peerReview.projectId, projectId))
    .orderBy(peerReview.createdAt)) as GrantReviewRow[];

  return rows
    .filter((r) => r.decision !== "comment")
    .map((r) => ({
      reviewerName: r.reviewerName || "Unknown reviewer",
      decision: r.decision,
      message: r.reviewComment,
      createdAtIso: r.createdAt.toISOString(),
      reviewJustification: hydrateReviewJustification({
        decision: r.decision,
        fallbackHackatimeProjectName,
        reviewEvidenceChecklist: r.reviewEvidenceChecklist,
        reviewedHackatimeRangeStart: r.reviewedHackatimeRangeStart,
        reviewedHackatimeRangeEnd: r.reviewedHackatimeRangeEnd,
        hourAdjustmentReasonMetadata: r.hourAdjustmentReasonMetadata,
      }),
    }));
}

/**
 * Load the per-devlog assessments of the LATEST approved review, joined with
 * their devlogs. Deflation is tied to time ranges: each entry carries the
 * devlog's window, logged vs approved time, the reviewer's reasons + note,
 * and verification links (joe.fraud scoped to the window, plus the devlog
 * page) — these render as the deflation breakdown in the Airtable
 * justification.
 */
async function loadDevlogDeflationEntries(input: {
  projectId: string;
  hackatimeUserId: string | null;
  appUrl: string | null;
}): Promise<AirtableDevlogDeflationEntry[]> {
  const latestApprovedReview = await db
    .select({ id: peerReview.id })
    .from(peerReview)
    .where(and(eq(peerReview.projectId, input.projectId), eq(peerReview.decision, "approved")))
    .orderBy(desc(peerReview.createdAt))
    .limit(1);

  const reviewId = latestApprovedReview[0]?.id;
  if (!reviewId) return [];

  const rows = await db
    .select({
      devlogId: peerReviewDevlogAssessment.devlogId,
      decision: peerReviewDevlogAssessment.decision,
      adjustedSeconds: peerReviewDevlogAssessment.adjustedSeconds,
      deflationReasons: peerReviewDevlogAssessment.deflationReasons,
      reviewedStartedAt: peerReviewDevlogAssessment.reviewedStartedAt,
      reviewedEndedAt: peerReviewDevlogAssessment.reviewedEndedAt,
      reviewedWindowSeconds: peerReviewDevlogAssessment.reviewedWindowSeconds,
      comment: peerReviewDevlogAssessment.comment,
      title: devlog.title,
      startedAt: devlog.startedAt,
      endedAt: devlog.endedAt,
      durationSeconds: devlog.durationSeconds,
    })
    .from(peerReviewDevlogAssessment)
    .innerJoin(devlog, eq(peerReviewDevlogAssessment.devlogId, devlog.id))
    .where(eq(peerReviewDevlogAssessment.reviewId, reviewId))
    .orderBy(devlog.startedAt);

  const base = input.appUrl ? input.appUrl.replace(/\/+$/g, "") : "";

  return rows.map((row) => {
    const loggedSeconds = Math.max(0, Math.floor(row.durationSeconds || 0));
    const approvedSeconds =
      row.decision === "accepted"
        ? loggedSeconds
        : row.decision === "rejected"
          ? 0
          : Math.max(0, Math.floor(row.adjustedSeconds ?? 0));
    const hasReviewedWindow = !!(row.reviewedStartedAt && row.reviewedEndedAt);
    // The joe.fraud link points at the window the reviewer actually
    // considered — the trimmed one when an override was applied.
    const reviewUrls = buildHackatimeDevlogReviewUrls({
      hackatimeId: input.hackatimeUserId,
      startedAt: (hasReviewedWindow ? row.reviewedStartedAt! : row.startedAt).toISOString(),
      endedAt: (hasReviewedWindow ? row.reviewedEndedAt! : row.endedAt).toISOString(),
    });
    return {
      title: row.title,
      startIso: row.startedAt.toISOString(),
      endIso: row.endedAt.toISOString(),
      loggedSeconds,
      approvedSeconds,
      decision: row.decision,
      deflationReasons: Array.isArray(row.deflationReasons) ? row.deflationReasons : [],
      note: row.comment?.trim() || null,
      reviewedStartIso: hasReviewedWindow ? row.reviewedStartedAt!.toISOString() : null,
      reviewedEndIso: hasReviewedWindow ? row.reviewedEndedAt!.toISOString() : null,
      reviewedWindowSeconds:
        typeof row.reviewedWindowSeconds === "number"
          ? Math.max(0, Math.floor(row.reviewedWindowSeconds))
          : null,
      hackatimeReviewUrl: reviewUrls?.joeFraudUrl ?? null,
      devlogUrl: base
        ? `${base}/projects/${encodeURIComponent(input.projectId)}/devlogs/${encodeURIComponent(row.devlogId)}`
        : null,
    };
  });
}

export type GrantContext = {
  projectRow: {
    id: string;
    name: string;
    status: string;
    creatorId: string | null;
    approvedHours: number | null;
    airtableRecordId: string | null;
    airtableRecordIsPreview: boolean;
    grantTechnicalJustification: string | null;
    creatorEmail: string | null;
    creatorSlackId: string | null;
  };
  input: AirtableGrantCreateInput;
};

/**
 * Load everything needed to build the Airtable grant payload for a project.
 * `technicalJustificationOverride` lets the preview endpoint reflect the text
 * the admin is currently editing before it is saved.
 */
export async function loadGrantContext(
  projectId: string,
  opts?: { technicalJustificationOverride?: string | null },
): Promise<GrantContext | null> {
  const rows = await db
    .select({
      id: project.id,
      status: project.status,
      creatorId: project.creatorId,
      approvedHours: project.approvedHours,
      name: project.name,
      hackatimeProjectName: project.hackatimeProjectName,
      hackatimeStartedAt: project.hackatimeStartedAt,
      hackatimeStoppedAt: project.hackatimeStoppedAt,
      description: project.description,
      codeUrl: project.codeUrl,
      videoUrl: project.videoUrl,
      playableDemoUrl: project.playableDemoUrl,
      screenshots: project.screenshots,
      submittedAt: project.submittedAt,
      airtableRecordId: project.airtableRecordId,
      airtableRecordIsPreview: project.airtableRecordIsPreview,
      grantTechnicalJustification: project.grantTechnicalJustification,
      creatorName: user.name,
      creatorEmail: user.email,
      creatorSlackId: user.slackId,
      creatorIdentityToken: user.identityToken,
      creatorBirthday: user.birthday,
      creatorHackatimeUserId: user.hackatimeUserId,
      addressLine1: user.addressLine1,
      addressLine2: user.addressLine2,
      city: user.city,
      stateProvince: user.stateProvince,
      country: user.country,
      zipPostalCode: user.zipPostalCode,
    })
    .from(project)
    .leftJoin(user, eq(project.creatorId, user.id))
    .where(eq(project.id, projectId))
    .limit(1);

  const current = rows[0];
  if (!current) return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || null;

  const [identityProfile, reviews, linkedProjects, devlogAssessments] = await Promise.all([
    fetchIdentityGrantProfile(current.creatorIdentityToken ?? null),
    loadGrantReviewsForAirtable(projectId, current.hackatimeProjectName),
    listProjectHackatimeProjects(projectId),
    loadDevlogDeflationEntries({
      projectId,
      hackatimeUserId: current.creatorHackatimeUserId?.trim() || null,
      appUrl,
    }),
  ]);

  const latestApprovedAtIso =
    reviews
      .filter((r) => r.decision === "approved" && r.createdAtIso)
      .map((r) => r.createdAtIso as string)
      .sort()
      .pop() ?? null;

  // The Hackatime review link sent to Airtable: joe.fraud over the project's
  // considered range, so a spot-checker lands on exactly what the reviewer saw.
  const hackatimeId = current.creatorHackatimeUserId?.trim() || null;
  const rangeStart = current.hackatimeStartedAt
    ? current.hackatimeStartedAt.toISOString().slice(0, 10)
    : null;
  const rangeEnd = current.hackatimeStoppedAt
    ? current.hackatimeStoppedAt.toISOString().slice(0, 10)
    : null;
  const hackatimeReviewLink =
    hackatimeId && rangeStart && rangeEnd
      ? buildJoeFraudUrl(hackatimeId, rangeStart, rangeEnd)
      : null;

  const technicalJustification =
    opts?.technicalJustificationOverride !== undefined
      ? opts.technicalJustificationOverride
      : current.grantTechnicalJustification;

  const hackatimeProjectNames =
    linkedProjects.length > 0
      ? linkedProjects.map((lp) => lp.name)
      : current.hackatimeProjectName.trim()
        ? [current.hackatimeProjectName.trim()]
        : [];

  const input: AirtableGrantCreateInput = {
    project: {
      id: current.id,
      name: current.name,
      description: current.description,
      hackatimeProjectName: current.hackatimeProjectName,
      codeUrl: current.codeUrl,
      playableDemoUrl: current.playableDemoUrl,
      videoUrl: current.videoUrl,
      screenshots: current.screenshots ?? [],
      submittedAtIso: current.submittedAt ? current.submittedAt.toISOString() : null,
      approvedHours: current.approvedHours ?? null,
      approvedAtIso: latestApprovedAtIso,
    },
    creator: {
      name: identityProfile.name ?? current.creatorName ?? "Unknown",
      email: identityProfile.email ?? current.creatorEmail ?? "",
      slackId: identityProfile.slackId ?? current.creatorSlackId ?? null,
      birthdayIso: identityProfile.birthday ?? current.creatorBirthday ?? null,
      hackatimeUserId: current.creatorHackatimeUserId ?? null,
    },
    shipping: {
      addressLine1: identityProfile.addressLine1 ?? current.addressLine1 ?? null,
      addressLine2: identityProfile.addressLine2 ?? current.addressLine2 ?? null,
      city: identityProfile.city ?? current.city ?? null,
      stateProvince: identityProfile.stateProvince ?? current.stateProvince ?? null,
      country: identityProfile.country ?? current.country ?? null,
      zipPostalCode: identityProfile.zipPostalCode ?? current.zipPostalCode ?? null,
    },
    appUrl,
    reviewStatus: "Approved" as const,
    reviews,
    technicalJustification: technicalJustification?.trim() || null,
    hackatimeProjectNames,
    hackatimeReviewLink,
    devlogAssessments,
  };

  return {
    projectRow: {
      id: current.id,
      name: current.name,
      status: current.status,
      creatorId: current.creatorId,
      approvedHours: current.approvedHours ?? null,
      airtableRecordId: current.airtableRecordId ?? null,
      airtableRecordIsPreview: current.airtableRecordIsPreview === true,
      grantTechnicalJustification: current.grantTechnicalJustification ?? null,
      creatorEmail: current.creatorEmail ?? null,
      creatorSlackId: current.creatorSlackId ?? null,
    },
    input,
  };
}

/**
 * Dry-run of the exact payload a grant/push would send. `fields` is
 * byte-for-byte what buildAirtableGrantFields produces for create AND update.
 */
export function previewGrantPayload(context: GrantContext) {
  const fields = buildAirtableGrantFields(context.input);
  const justificationText = formatAirtableHoursJustification(context.input.reviews, {
    projectId: context.input.project.id,
    appUrl: context.input.appUrl ?? null,
    codeUrl: context.input.project.codeUrl,
    hackatimeUserId: context.input.creator.hackatimeUserId,
    approvedHours: context.input.project.approvedHours,
    approvedAtIso: context.input.project.approvedAtIso,
    technicalJustification: context.input.technicalJustification ?? null,
    hackatimeProjectNames: context.input.hackatimeProjectNames ?? [],
    hackatimeReviewLink: context.input.hackatimeReviewLink ?? null,
    devlogAssessments: context.input.devlogAssessments ?? [],
  });
  return { fields, justificationText };
}

/**
 * The hours invariant, asserted right before anything is sent to Airtable:
 * the Override Hours Spent value must equal the project's stored approved
 * hours (which the review flow derived from per-devlog assessments). If they
 * ever drift, the push is refused — nothing unverifiable enters the Unified
 * Database.
 */
export function assertGrantHoursInvariant(context: GrantContext): { ok: true } | { ok: false; error: string } {
  const payloadHours = context.input.project.approvedHours;
  const storedHours = context.projectRow.approvedHours;
  if (
    payloadHours === null ||
    storedHours === null ||
    !Number.isFinite(payloadHours) ||
    !Number.isFinite(storedHours) ||
    Math.abs(payloadHours - storedHours) > 1e-9
  ) {
    return {
      ok: false,
      error:
        "Hours invariant violated: the payload's Override Hours Spent does not match the project's approved hours. Refresh and re-check the review before granting.",
    };
  }
  return { ok: true };
}

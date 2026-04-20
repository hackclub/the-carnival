import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { peerReview, project, tokenLedger, user, type ProjectStatus, type ReviewDecision } from "@/db/schema";
import { refreshHackatimeProjectSnapshotForRange } from "@/lib/hackatime";
import { parseConsideredHackatimeRange } from "@/lib/hackatime-range";
import { getServerSession } from "@/lib/server-session";
import { approvedHoursWithinSnapshot } from "@/lib/review-rules";
import { tokensForApprovedHours } from "@/lib/tokens";
import { generateId, isUniqueConstraintError } from "@/lib/api-utils";
import { appendReviewAudit } from "@/lib/review-audit";
import {
  type AirtableGrantCreateInput,
  createAirtableGrantRecord,
  toAirtableCreateErrorDetails,
  getAirtableConfigErrors,
  AIRTABLE_GRANTS_TABLE_ENV,
} from "@/lib/airtable";
import { hydrateReviewJustification } from "@/lib/review-justification";

type AdminProjectPatchBody = {
  status?: unknown;
  consideredHackatimeRange?: unknown;
  resubmissionBlocked?: unknown;
};

function isAdmin(role: unknown): role is "admin" {
  return role === "admin";
}

function isAdminEditableStatus(value: unknown): value is ProjectStatus {
  return (
    value === "work-in-progress" ||
    value === "in-review" ||
    value === "shipped" ||
    value === "granted"
  );
}

function hasOwnProperty<T extends object>(value: T, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

type IdentityGrantProfile = {
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

type GrantProjectRow = {
  name: string;
  description: string;
  hackatimeProjectName: string;
  codeUrl: string;
  playableDemoUrl: string;
  videoUrl: string;
  screenshots: string[] | null;
  submittedAt: Date | null;
  approvedHours: number | null;
  creatorName: string | null;
  creatorEmail: string | null;
  creatorSlackId: string | null;
  creatorBirthday: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateProvince: string | null;
  country: string | null;
  zipPostalCode: string | null;
};

type GrantReviewRow = {
  reviewerName: string | null;
  decision: ReviewDecision;
  reviewComment: string;
  reviewEvidenceChecklist: unknown;
  reviewedHackatimeRangeStart: Date | null;
  reviewedHackatimeRangeEnd: Date | null;
  hourAdjustmentReasonMetadata: unknown;
  reviewJustification?: unknown;
};

type AirtableGrantReview = NonNullable<AirtableGrantCreateInput["reviews"]>[number];

const reviewJustificationColumn = (
  peerReview as unknown as { reviewJustification?: typeof peerReview.id }
).reviewJustification;

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

function parseIdentityGrantProfile(payload: unknown): IdentityGrantProfile {
  const out: IdentityGrantProfile = {
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
    address.state ??
      address.state_province ??
      address.stateProvince ??
      address.region,
  );
  out.country = toNullableString(address.country ?? address.country_code ?? address.countryCode);
  out.zipPostalCode = toNullableString(
    address.postal_code ??
      address.zip_postal_code ??
      address.zipPostalCode ??
      address.postcode,
  );

  return out;
}

async function fetchIdentityGrantProfile(identityToken: string | null): Promise<IdentityGrantProfile> {
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

function mapReviewsForAirtable(
  reviews: GrantReviewRow[],
  fallbackHackatimeProjectName: string,
): AirtableGrantReview[] {
  return reviews
    .filter((r) => r.decision !== "comment")
    .map((r) => ({
      reviewerName: r.reviewerName || "Unknown reviewer",
      decision: r.decision,
      message: r.reviewComment,
      reviewJustification: hydrateReviewJustification({
        decision: r.decision,
        fallbackHackatimeProjectName,
        reviewEvidenceChecklist: r.reviewEvidenceChecklist,
        reviewedHackatimeRangeStart: r.reviewedHackatimeRangeStart,
        reviewedHackatimeRangeEnd: r.reviewedHackatimeRangeEnd,
        hourAdjustmentReasonMetadata: r.hourAdjustmentReasonMetadata,
        reviewJustification: r.reviewJustification,
      }),
    }));
}

async function loadGrantReviewsForAirtable(
  projectId: string,
  fallbackHackatimeProjectName: string,
) {
  const rows = (await db
    .select({
      decision: peerReview.decision,
      reviewComment: peerReview.reviewComment,
      reviewerName: user.name,
      reviewEvidenceChecklist: peerReview.reviewEvidenceChecklist,
      reviewedHackatimeRangeStart: peerReview.reviewedHackatimeRangeStart,
      reviewedHackatimeRangeEnd: peerReview.reviewedHackatimeRangeEnd,
      hourAdjustmentReasonMetadata: peerReview.hourAdjustmentReasonMetadata,
      ...(reviewJustificationColumn ? { reviewJustification: reviewJustificationColumn } : {}),
    })
    .from(peerReview)
    .leftJoin(user, eq(peerReview.reviewerId, user.id))
    .where(eq(peerReview.projectId, projectId))
    .orderBy(peerReview.createdAt)) as GrantReviewRow[];

  return mapReviewsForAirtable(rows, fallbackHackatimeProjectName);
}

function buildAirtableGrantInput(
  current: GrantProjectRow,
  identityProfile: IdentityGrantProfile,
  reviews: AirtableGrantReview[],
) {
  return {
    project: {
      name: current.name,
      description: current.description,
      hackatimeProjectName: current.hackatimeProjectName,
      codeUrl: current.codeUrl,
      playableDemoUrl: current.playableDemoUrl,
      videoUrl: current.videoUrl,
      screenshots: current.screenshots ?? [],
      submittedAtIso: current.submittedAt ? current.submittedAt.toISOString() : null,
      approvedHours: current.approvedHours ?? null,
    },
    creator: {
      name: identityProfile.name ?? current.creatorName ?? "Unknown",
      email: identityProfile.email ?? current.creatorEmail ?? "",
      slackId: identityProfile.slackId ?? current.creatorSlackId ?? null,
      birthdayIso: identityProfile.birthday ?? current.creatorBirthday ?? null,
    },
    shipping: {
      addressLine1: identityProfile.addressLine1 ?? current.addressLine1 ?? null,
      addressLine2: identityProfile.addressLine2 ?? current.addressLine2 ?? null,
      city: identityProfile.city ?? current.city ?? null,
      stateProvince: identityProfile.stateProvince ?? current.stateProvince ?? null,
      country: identityProfile.country ?? current.country ?? null,
      zipPostalCode: identityProfile.zipPostalCode ?? current.zipPostalCode ?? null,
    },
    reviewStatus: "Approved" as const,
    reviews,
  };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const adminUserId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!adminUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;

  let body: AdminProjectPatchBody;
  try {
    body = (await req.json()) as AdminProjectPatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const hasStatusUpdate = hasOwnProperty(body, "status");
  const hasRangeUpdate = hasOwnProperty(body, "consideredHackatimeRange");
  const hasResubmissionBlockUpdate = hasOwnProperty(body, "resubmissionBlocked");
  if (!hasStatusUpdate && !hasRangeUpdate && !hasResubmissionBlockUpdate) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }
  if (hasStatusUpdate && !isAdminEditableStatus(body.status)) {
    return NextResponse.json(
      { error: "Invalid status. Allowed: work-in-progress, in-review, shipped, granted" },
      { status: 400 },
    );
  }
  if (hasResubmissionBlockUpdate && typeof body.resubmissionBlocked !== "boolean") {
    return NextResponse.json(
      { error: "resubmissionBlocked must be a boolean" },
      { status: 400 },
    );
  }

  const now = new Date();
  const nextStatus = hasStatusUpdate ? (body.status as ProjectStatus) : undefined;

  if (hasResubmissionBlockUpdate && !hasStatusUpdate && !hasRangeUpdate) {
    const nextBlocked = body.resubmissionBlocked as boolean;
    const rows = await db
      .select({
        id: project.id,
        resubmissionBlocked: project.resubmissionBlocked,
        resubmissionBlockedAt: project.resubmissionBlockedAt,
        resubmissionBlockedBy: project.resubmissionBlockedBy,
      })
      .from(project)
      .where(eq(project.id, id))
      .limit(1);

    const current = rows[0];
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await db
      .update(project)
      .set({
        resubmissionBlocked: nextBlocked,
        resubmissionBlockedAt: nextBlocked ? now : null,
        resubmissionBlockedBy: nextBlocked ? adminUserId : null,
        ...(nextBlocked ? {} : { resubmissionBlockedReason: null }),
        updatedAt: now,
      })
      .where(eq(project.id, id))
      .returning({
        id: project.id,
        status: project.status,
        resubmissionBlocked: project.resubmissionBlocked,
        resubmissionBlockedAt: project.resubmissionBlockedAt,
        resubmissionBlockedBy: project.resubmissionBlockedBy,
        updatedAt: project.updatedAt,
      });

    const updatedProject = updated[0];
    if (!updatedProject) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (current.resubmissionBlocked !== nextBlocked) {
      try {
        await appendReviewAudit({
          projectId: id,
          actorId: adminUserId,
          actorRole: "admin",
          action: "resubmission_reenabled",
          details: {
            nextBlocked,
            previouslyBlocked: current.resubmissionBlocked,
            previouslyBlockedAt: current.resubmissionBlockedAt
              ? current.resubmissionBlockedAt.toISOString()
              : null,
            previouslyBlockedBy: current.resubmissionBlockedBy,
          },
          at: now,
        });
      } catch (err) {
        console.warn("Failed to append resubmission audit log", err);
      }
    }

    return NextResponse.json({
      project: {
        ...updatedProject,
        resubmissionBlockedAt: updatedProject.resubmissionBlockedAt
          ? updatedProject.resubmissionBlockedAt.toISOString()
          : null,
        updatedAt: updatedProject.updatedAt.toISOString(),
      },
    });
  }

  if (hasRangeUpdate) {
    const parsedRange = parseConsideredHackatimeRange(body.consideredHackatimeRange);
    if (!parsedRange.ok) {
      return NextResponse.json({ error: parsedRange.error }, { status: 400 });
    }

    const rows = await db
      .select({
        id: project.id,
        status: project.status,
        creatorId: project.creatorId,
        approvedHours: project.approvedHours,
        hackatimeProjectName: project.hackatimeProjectName,
        hackatimeStartedAt: project.hackatimeStartedAt,
        hackatimeStoppedAt: project.hackatimeStoppedAt,
        hackatimeTotalSeconds: project.hackatimeTotalSeconds,
        submittedAt: project.submittedAt,
      })
      .from(project)
      .where(eq(project.id, id))
      .limit(1);

    const current = rows[0];
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (current.status === "granted") {
      return NextResponse.json(
        { error: "Granted projects cannot change their considered Hackatime range." },
        { status: 409 },
      );
    }
    if (!current.creatorId) {
      return NextResponse.json(
        { error: "Project has no creator; cannot refresh the considered Hackatime range." },
        { status: 409 },
      );
    }
    if (!current.hackatimeProjectName.trim()) {
      return NextResponse.json(
        { error: "Project has no Hackatime project name to refresh." },
        { status: 400 },
      );
    }

    try {
      const refreshed = await refreshHackatimeProjectSnapshotForRange(current.creatorId, {
        projectName: current.hackatimeProjectName,
        range: parsedRange.value,
      });

      let statusAfter = current.status;
      let approvedHoursAfter = current.approvedHours;
      let notice: string | null = null;

      if (
        current.status === "shipped" &&
        current.approvedHours !== null &&
        !approvedHoursWithinSnapshot(current.approvedHours, refreshed.hackatimeTotalSeconds)
      ) {
        statusAfter = "in-review";
        approvedHoursAfter = null;
        notice =
          "Saved changes and returned the project to review because the refreshed Hackatime range is now below the previously approved hours.";
      }

      const updated = await db
        .update(project)
        .set({
          hackatimeStartedAt: refreshed.hackatimeStartedAt,
          hackatimeStoppedAt: refreshed.hackatimeStoppedAt,
          hackatimeTotalSeconds: refreshed.hackatimeTotalSeconds,
          status: statusAfter,
          approvedHours: approvedHoursAfter,
          submittedAt: statusAfter === "in-review" ? now : current.submittedAt,
          updatedAt: now,
        })
        .where(eq(project.id, id))
        .returning({
          id: project.id,
          status: project.status,
          approvedHours: project.approvedHours,
          hackatimeStartedAt: project.hackatimeStartedAt,
          hackatimeStoppedAt: project.hackatimeStoppedAt,
          hackatimeTotalSeconds: project.hackatimeTotalSeconds,
          submittedAt: project.submittedAt,
          updatedAt: project.updatedAt,
        });

      const updatedProject = updated[0];
      if (!updatedProject) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      return NextResponse.json({
        project: {
          ...updatedProject,
          hackatimeStartedAt: updatedProject.hackatimeStartedAt
            ? updatedProject.hackatimeStartedAt.toISOString()
            : null,
          hackatimeStoppedAt: updatedProject.hackatimeStoppedAt
            ? updatedProject.hackatimeStoppedAt.toISOString()
            : null,
          submittedAt: updatedProject.submittedAt ? updatedProject.submittedAt.toISOString() : null,
          updatedAt: updatedProject.updatedAt.toISOString(),
        },
        notice,
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Failed to refresh Hackatime for the selected range.";
      return NextResponse.json(
        { error: `Could not refresh the considered Hackatime range. ${message}` },
        { status: 400 },
      );
    }
  }

  try {
    // If granting, create the Airtable record first. If Airtable fails, we abort the grant
    // (so admins see the error immediately and we don't issue tokens without a record).
    if (nextStatus === "granted") {
      const rows = await db
        .select({
          id: project.id,
          status: project.status,
          creatorId: project.creatorId,
          approvedHours: project.approvedHours,
          name: project.name,
          hackatimeProjectName: project.hackatimeProjectName,
          description: project.description,
          codeUrl: project.codeUrl,
          videoUrl: project.videoUrl,
          playableDemoUrl: project.playableDemoUrl,
          screenshots: project.screenshots,
          submittedAt: project.submittedAt,
          creatorName: user.name,
          creatorEmail: user.email,
          creatorSlackId: user.slackId,
          creatorIdentityToken: user.identityToken,
          creatorBirthday: user.birthday,
          addressLine1: user.addressLine1,
          addressLine2: user.addressLine2,
          city: user.city,
          stateProvince: user.stateProvince,
          country: user.country,
          zipPostalCode: user.zipPostalCode,
        })
        .from(project)
        .leftJoin(user, eq(project.creatorId, user.id))
        .where(eq(project.id, id))
        .limit(1);

      const current = rows[0];
      if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

      // Only allow granting from shipped (or no-op if already granted).
      if (current.status !== "shipped" && current.status !== "granted") {
        return NextResponse.json(
          { error: "Project must be shipped before it can be granted." },
          { status: 409 },
        );
      }

      // If already granted, don't re-insert into Airtable.
      if (current.status !== "granted") {
        if (!current.creatorId) {
          return NextResponse.json(
            { error: "Project has no creator; cannot create Airtable record." },
            { status: 409 },
          );
        }
        if (current.approvedHours === null || current.approvedHours === undefined) {
          return NextResponse.json(
            { error: "Project has no approved hours; cannot create Airtable record." },
            { status: 409 },
          );
        }

        const missingEnv = getAirtableConfigErrors(process.env);
        if (missingEnv.length) {
          return NextResponse.json(
            {
              error: "Airtable is not configured for grants.",
              details: `Missing env var(s): ${missingEnv.join(", ")}.`,
              hints: [
                "Add the missing env vars in .env.local and restart the dev server.",
                `Make sure \`${AIRTABLE_GRANTS_TABLE_ENV}\` matches the table name (or table ID) in Airtable.`,
              ],
            },
            { status: 500 },
          );
        }

        try {
          const identityProfile = await fetchIdentityGrantProfile(current.creatorIdentityToken ?? null);
          const reviews = await loadGrantReviewsForAirtable(id, current.hackatimeProjectName);

          await createAirtableGrantRecord(
            buildAirtableGrantInput(current, identityProfile, reviews),
          );
        } catch (err) {
          const details = toAirtableCreateErrorDetails(err);
          return NextResponse.json(
            {
              error: "Failed to create Airtable grant record.",
              details: details.message,
              statusCode: details.statusCode,
              airtableError: details.airtableError,
              hints: details.hints,
            },
            { status: 502 },
          );
        }
      }
    }

    const result = await db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: project.id,
          status: project.status,
          creatorId: project.creatorId,
          approvedHours: project.approvedHours,
          name: project.name,
          codeUrl: project.codeUrl,
        })
        .from(project)
        .where(eq(project.id, id))
        .limit(1);

      const current = rows[0];
      if (!current) return { error: "Not found" as const, status: 404 as const };

      const referenceType = "project_grant";

      // Once tokens have been issued for a grant, don't allow changing away from granted
      // (we don't support reversing token issuance).
      if (current.status === "granted" && nextStatus !== "granted") {
        const issued = await tx
          .select({ id: tokenLedger.id })
          .from(tokenLedger)
          .where(
            and(
              eq(tokenLedger.referenceType, referenceType),
              eq(tokenLedger.referenceId, id),
              eq(tokenLedger.kind, "issue"),
            ),
          )
          .limit(1);

        if (issued[0]) {
          return {
            error: "Cannot undo grant after tokens have been issued for this project.",
            status: 409 as const,
          };
        }
      }

      if (nextStatus === "granted") {
        // Only allow granting from shipped (or no-op if already granted).
        if (current.status !== "shipped" && current.status !== "granted") {
          return { error: "Project must be shipped before it can be granted.", status: 409 as const };
        }
        if (!current.creatorId) {
          return { error: "Project has no creator; cannot issue tokens.", status: 409 as const };
        }
        if (current.approvedHours === null || current.approvedHours === undefined) {
          return { error: "Project has no approved hours; cannot issue tokens.", status: 409 as const };
        }

        const tokensToIssue = tokensForApprovedHours(current.approvedHours);
        const projectUrl = current.codeUrl;
        const reason = `Issue ${tokensToIssue} tokens for Shipped project (${current.name}) ${current.id}, ${projectUrl}`;

        // 1) Update status to granted
        await tx
          .update(project)
          .set({ status: "granted", updatedAt: now })
          .where(eq(project.id, id));

        // 2) Idempotently write the issuance ledger entry (unique on reference+kind)
        await tx
          .insert(tokenLedger)
          .values({
            id: generateId(),
            kind: "issue",
            tokens: tokensToIssue,
            reason,
            issuedToUserId: current.creatorId,
            byUserId: adminUserId,
            referenceType,
            referenceId: id,
            createdAt: now,
          })
          .onConflictDoNothing({
            target: [tokenLedger.referenceType, tokenLedger.referenceId, tokenLedger.kind],
          });

        return { ok: true as const };
      }

      // Re-queueing should refresh the queue timestamp so it shows up appropriately.
      const submittedAtUpdate = nextStatus === "in-review" ? ({ submittedAt: now } as const) : {};

      await tx
        .update(project)
        .set({ status: nextStatus, updatedAt: now, ...submittedAtUpdate })
        .where(eq(project.id, id));

      return { ok: true as const };
    });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    const updated = await db
      .select({ id: project.id, status: project.status, updatedAt: project.updatedAt })
      .from(project)
      .where(eq(project.id, id))
      .limit(1);

    const p = updated[0];
    if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ project: p });
  } catch (err) {
    // If two admins click grant at the same time, the token ledger insert may race;
    // unique constraint means only one issuance will stick.
    if (isUniqueConstraintError(err)) {
      const updated = await db
        .select({ id: project.id, status: project.status, updatedAt: project.updatedAt })
        .from(project)
        .where(eq(project.id, id))
        .limit(1);
      const p = updated[0];
      if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ project: p });
    }
    console.error("Admin project PATCH failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const adminUserId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!adminUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;

  const rows = await db
    .select({
      id: project.id,
      status: project.status,
      creatorId: project.creatorId,
      approvedHours: project.approvedHours,
      name: project.name,
      hackatimeProjectName: project.hackatimeProjectName,
      description: project.description,
      codeUrl: project.codeUrl,
      videoUrl: project.videoUrl,
      playableDemoUrl: project.playableDemoUrl,
      screenshots: project.screenshots,
      submittedAt: project.submittedAt,
      creatorName: user.name,
      creatorEmail: user.email,
      creatorSlackId: user.slackId,
      creatorIdentityToken: user.identityToken,
      creatorBirthday: user.birthday,
      addressLine1: user.addressLine1,
      addressLine2: user.addressLine2,
      city: user.city,
      stateProvince: user.stateProvince,
      country: user.country,
      zipPostalCode: user.zipPostalCode,
    })
    .from(project)
    .leftJoin(user, eq(project.creatorId, user.id))
    .where(eq(project.id, id))
    .limit(1);

  const current = rows[0];
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (current.status !== "granted") {
    return NextResponse.json(
      { error: "Project must be granted before pushing to Airtable." },
      { status: 409 },
    );
  }

  const issued = await db
    .select({ id: tokenLedger.id })
    .from(tokenLedger)
    .where(
      and(
        eq(tokenLedger.referenceType, "project_grant"),
        eq(tokenLedger.referenceId, id),
        eq(tokenLedger.kind, "issue"),
      ),
    )
    .limit(1);

  if (!issued[0]) {
    return NextResponse.json(
      { error: "Tokens have not been issued for this project." },
      { status: 409 },
    );
  }

  if (!current.creatorId) {
    return NextResponse.json(
      { error: "Project has no creator; cannot create Airtable record." },
      { status: 409 },
    );
  }
  if (current.approvedHours === null || current.approvedHours === undefined) {
    return NextResponse.json(
      { error: "Project has no approved hours; cannot create Airtable record." },
      { status: 409 },
    );
  }

  const missingEnv = getAirtableConfigErrors(process.env);
  if (missingEnv.length) {
    return NextResponse.json(
      {
        error: "Airtable is not configured for grants.",
        details: `Missing env var(s): ${missingEnv.join(", ")}.`,
        hints: [
          "Add the missing env vars in .env.local and restart the dev server.",
          `Make sure \`${AIRTABLE_GRANTS_TABLE_ENV}\` matches the table name (or table ID) in Airtable.`,
        ],
      },
      { status: 500 },
    );
  }

  try {
    const identityProfile = await fetchIdentityGrantProfile(current.creatorIdentityToken ?? null);
    const reviews = await loadGrantReviewsForAirtable(id, current.hackatimeProjectName);

    const record = await createAirtableGrantRecord(
      buildAirtableGrantInput(current, identityProfile, reviews),
    );

    return NextResponse.json({ ok: true, airtableRecordId: record.id });
  } catch (err) {
    const details = toAirtableCreateErrorDetails(err);
    return NextResponse.json(
      {
        error: "Failed to create Airtable grant record.",
        details: details.message,
        statusCode: details.statusCode,
        airtableError: details.airtableError,
        hints: details.hints,
      },
      { status: 502 },
    );
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;

  const deleted = await db
    .delete(project)
    .where(eq(project.id, id))
    .returning({ id: project.id });

  if (deleted.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

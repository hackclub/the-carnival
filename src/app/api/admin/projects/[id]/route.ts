import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bountyProject, project, tokenLedger, type ProjectStatus } from "@/db/schema";
import { refreshHackatimeProjectSnapshotForRange } from "@/lib/hackatime";
import { parseConsideredHackatimeRange } from "@/lib/hackatime-range";
import { getServerSession } from "@/lib/server-session";
import { approvedHoursWithinSnapshot } from "@/lib/review-rules";
import { tokensForApprovedHours } from "@/lib/tokens";
import { bountyPrizeUsdToTokens } from "@/lib/bounties";
import { generateId, isUniqueConstraintError } from "@/lib/api-utils";
import { appendReviewAudit } from "@/lib/review-audit";
import {
  createAirtableGrantRecord,
  updateAirtableGrantRecord,
  deleteAirtableGrantRecord,
  toAirtableCreateErrorDetails,
  getAirtableConfigErrors,
  AIRTABLE_GRANTS_TABLE_ENV,
} from "@/lib/airtable";
import { assertGrantHoursInvariant, loadGrantContext } from "@/lib/review/grant";
import { sendReviewEmail } from "@/lib/loops";
import { notifyReviewDM } from "@/lib/slack";

type AdminProjectPatchBody = {
  status?: unknown;
  consideredHackatimeRange?: unknown;
  resubmissionBlocked?: unknown;
  /**
   * Final human-written "Specific Technical Features" hours justification.
   * Can be saved on its own (draft) or sent along with status="granted".
   * Required (non-empty, saved or inline) before a grant can proceed.
   */
  grantTechnicalJustification?: unknown;
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

/**
 * The ONLY "approved" notification the creator ever receives — sent at grant
 * time (pass 2), when tokens really are in their wallet. Pass-1 approval is
 * deliberately silent (see /api/review/[id]).
 */
async function notifyCreatorGranted(input: {
  projectId: string;
  projectName: string;
  creatorEmail: string | null;
  creatorSlackId: string | null;
  approvedHours: number | null;
  tokensIssued: number;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  let projectLink = `/projects/${input.projectId}`;
  if (appUrl) {
    try {
      projectLink = new URL(`/projects/${input.projectId}`, appUrl).toString();
    } catch {
      // fall back to relative
    }
  }

  const message =
    `Your project "${input.projectName}" has been approved` +
    `${input.approvedHours !== null ? ` (${input.approvedHours} hours)` : ""} and granted! ` +
    `${input.tokensIssued} tokens have been credited to your Carnival wallet.`;

  if (input.creatorEmail) {
    await sendReviewEmail(input.creatorEmail, message, "The Carnival", projectLink).catch((err) => {
      console.warn("sendReviewEmail on grant failed", err);
    });
  }
  if (input.creatorSlackId) {
    await notifyReviewDM({
      slackId: input.creatorSlackId,
      projectName: input.projectName,
      status: "approved",
      comment: message,
      projectUrl: projectLink,
      creatorSlackId: input.creatorSlackId,
    }).catch((err) => {
      console.warn("notifyReviewDM on grant failed", err);
    });
  }
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
  const hasTechnicalJustificationUpdate = hasOwnProperty(body, "grantTechnicalJustification");
  if (
    !hasStatusUpdate &&
    !hasRangeUpdate &&
    !hasResubmissionBlockUpdate &&
    !hasTechnicalJustificationUpdate
  ) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }
  const technicalJustificationInput = hasTechnicalJustificationUpdate
    ? typeof body.grantTechnicalJustification === "string"
      ? body.grantTechnicalJustification.trim().slice(0, 8000)
      : ""
    : null;

  // Standalone save of the technical justification draft (no status change).
  if (hasTechnicalJustificationUpdate && !hasStatusUpdate && !hasRangeUpdate && !hasResubmissionBlockUpdate) {
    const updated = await db
      .update(project)
      .set({ grantTechnicalJustification: technicalJustificationInput || null, updatedAt: new Date() })
      .where(eq(project.id, id))
      .returning({ id: project.id, grantTechnicalJustification: project.grantTechnicalJustification });
    if (!updated[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ project: updated[0] });
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

  let grantNotification: Parameters<typeof notifyCreatorGranted>[0] | null = null;

  try {
    // If granting, create/update the Airtable record first. If Airtable fails,
    // we abort the grant (so admins see the error immediately and we don't
    // issue tokens without a Unified Database record).
    if (nextStatus === "granted") {
      const context = await loadGrantContext(id, {
        // Justification sent inline with the grant wins; otherwise the stored one.
        ...(hasTechnicalJustificationUpdate
          ? { technicalJustificationOverride: technicalJustificationInput }
          : {}),
      });
      if (!context) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const current = context.projectRow;

      // Only allow granting from shipped (or no-op if already granted).
      if (current.status !== "shipped" && current.status !== "granted") {
        return NextResponse.json(
          { error: "Project must be shipped before it can be granted." },
          { status: 409 },
        );
      }

      // If already granted, don't re-push to Airtable.
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

        // Pass 2 requires the human-written "Specific Technical Features"
        // justification — a grant without it fails YSWS spot-check standards.
        if (!context.input.technicalJustification) {
          return NextResponse.json(
            {
              error:
                "Write the Specific Technical Features justification before granting. It is the human-written evidence for the approved hours.",
              code: "technical_justification_required",
            },
            { status: 400 },
          );
        }

        const invariant = assertGrantHoursInvariant(context);
        if (!invariant.ok) {
          return NextResponse.json({ error: invariant.error }, { status: 409 });
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
          // Idempotent by record id: if a record already exists — including a
          // [PREVIEW] push — update it instead of creating a duplicate. A
          // preview record is thereby PROMOTED in place: the real payload
          // overwrites the markers.
          const record = current.airtableRecordId
            ? await updateAirtableGrantRecord(current.airtableRecordId, context.input)
            : await createAirtableGrantRecord(context.input);

          await db
            .update(project)
            .set({
              airtableRecordId: record.id,
              airtableRecordIsPreview: false,
              grantTechnicalJustification: context.input.technicalJustification,
              updatedAt: new Date(),
            })
            .where(eq(project.id, id));
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

        grantNotification = {
          projectId: id,
          projectName: current.name,
          creatorEmail: current.creatorEmail,
          creatorSlackId: current.creatorSlackId,
          approvedHours: current.approvedHours,
          tokensIssued: tokensForApprovedHours(current.approvedHours),
        };
      }
    }

    const result = await db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: project.id,
          status: project.status,
          creatorId: project.creatorId,
          approvedHours: project.approvedHours,
          bountyProjectId: project.bountyProjectId,
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
        const bountyReferenceType = "bounty_bonus";
        let bountyBonus:
          | {
              referenceId: string;
              tokens: number;
              reason: string;
            }
          | null = null;

        if (current.bountyProjectId) {
          const bountyRows = await tx
            .select({
              id: bountyProject.id,
              name: bountyProject.name,
              prizeUsd: bountyProject.prizeUsd,
              status: bountyProject.status,
            })
            .from(bountyProject)
            .where(eq(bountyProject.id, current.bountyProjectId))
            .limit(1);

          const linkedBounty = bountyRows[0];
          if (linkedBounty?.status === "approved") {
            const bountyTokens = bountyPrizeUsdToTokens(linkedBounty.prizeUsd);
            if (bountyTokens > 0) {
              bountyBonus = {
                referenceId: `${current.id}:${linkedBounty.id}`,
                tokens: bountyTokens,
                reason: `Issue ${bountyTokens} bonus tokens for bounty "${linkedBounty.name}" (${linkedBounty.id}) on project ${current.id}. Bounty prize: $${linkedBounty.prizeUsd}.`,
              };
            }
          }
        }

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

        if (bountyBonus) {
          await tx
            .insert(tokenLedger)
            .values({
              id: generateId(),
              kind: "issue",
              tokens: bountyBonus.tokens,
              reason: bountyBonus.reason,
              issuedToUserId: current.creatorId,
              byUserId: adminUserId,
              referenceType: bountyReferenceType,
              referenceId: bountyBonus.referenceId,
              createdAt: now,
            })
            .onConflictDoNothing({
              target: [tokenLedger.referenceType, tokenLedger.referenceId, tokenLedger.kind],
            });
        }

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

    // Tokens are issued and the Airtable record exists — this is the moment
    // the creator finally hears "approved" (best-effort, outside the txn).
    if (grantNotification) {
      await notifyCreatorGranted(grantNotification);
    }

    // If the project moves away from the grant queue while a [PREVIEW]
    // Airtable record exists, delete that record (best-effort) so no preview
    // rows linger in the Unified Database.
    if (nextStatus && nextStatus !== "granted") {
      try {
        const rows = await db
          .select({
            airtableRecordId: project.airtableRecordId,
            airtableRecordIsPreview: project.airtableRecordIsPreview,
          })
          .from(project)
          .where(eq(project.id, id))
          .limit(1);
        const row = rows[0];
        if (row?.airtableRecordId && row.airtableRecordIsPreview) {
          await deleteAirtableGrantRecord(row.airtableRecordId);
          await db
            .update(project)
            .set({ airtableRecordId: null, airtableRecordIsPreview: false, updatedAt: new Date() })
            .where(eq(project.id, id));
        }
      } catch (err) {
        console.warn("Failed to clean up preview Airtable record", err);
      }
    }

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

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const adminUserId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!adminUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;

  // Manual "Push to Airtable". Idempotent by default: when the project already
  // has an Airtable record id, the push UPDATES that record. Creating an
  // ADDITIONAL record requires the explicit createNew flag (the UI warns
  // before sending it), and the stored id then points at the newest record.
  //
  // Preview mode (preview: true) pushes a clearly [PREVIEW]-marked record for
  // a SHIPPED (pass-1 approved, not yet granted) project so the admin can see
  // the justification in Airtable itself before granting. The record is
  // promoted in place by the grant, or deleted if the project leaves the
  // grant queue.
  let createNew = false;
  let preview = false;
  let previewTechnicalJustification: string | undefined;
  try {
    const body = (await req.json().catch(() => null)) as
      | { createNew?: unknown; preview?: unknown; technicalJustification?: unknown }
      | null;
    createNew = body?.createNew === true;
    preview = body?.preview === true;
    previewTechnicalJustification =
      typeof body?.technicalJustification === "string"
        ? body.technicalJustification.trim().slice(0, 8000)
        : undefined;
  } catch {
    createNew = false;
  }

  const context = await loadGrantContext(id, {
    // Preview reflects the justification the admin is editing right now.
    ...(preview && previewTechnicalJustification !== undefined
      ? { technicalJustificationOverride: previewTechnicalJustification }
      : {}),
  });
  if (!context) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const current = context.projectRow;

  if (preview) {
    if (current.status !== "shipped") {
      return NextResponse.json(
        { error: "Preview pushes are for shipped (pass-1 approved) projects awaiting grant." },
        { status: 409 },
      );
    }
  } else {
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
  const invariant = assertGrantHoursInvariant(context);
  if (!invariant.ok) {
    return NextResponse.json({ error: invariant.error }, { status: 409 });
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
    // Preview always upserts the stored record (never duplicates).
    const shouldUpdate = preview ? !!current.airtableRecordId : !createNew && !!current.airtableRecordId;
    const input = preview ? { ...context.input, preview: true } : context.input;
    const record = shouldUpdate
      ? await updateAirtableGrantRecord(current.airtableRecordId as string, input)
      : await createAirtableGrantRecord(input);

    await db
      .update(project)
      .set({
        airtableRecordId: record.id,
        airtableRecordIsPreview: preview,
        updatedAt: new Date(),
      })
      .where(eq(project.id, id));

    return NextResponse.json({
      ok: true,
      airtableRecordId: record.id,
      preview,
      mode: shouldUpdate ? "updated" : "created",
    });
  } catch (err) {
    const details = toAirtableCreateErrorDetails(err);
    return NextResponse.json(
      {
        error: "Failed to push the Airtable grant record.",
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

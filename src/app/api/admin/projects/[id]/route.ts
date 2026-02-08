import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { peerReview, project, tokenLedger, user, type ProjectStatus } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";
import { tokensForApprovedHours } from "@/lib/tokens";
import { generateId, isUniqueConstraintError } from "@/lib/api-utils";
import {
  createAirtableGrantRecord,
  toAirtableCreateErrorDetails,
  getAirtableConfigErrors,
  AIRTABLE_GRANTS_TABLE_ENV,
} from "@/lib/airtable";

type AdminProjectPatchBody = {
  status?: unknown;
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

  if (!isAdminEditableStatus(body.status)) {
    return NextResponse.json(
      { error: "Invalid status. Allowed: work-in-progress, in-review, shipped, granted" },
      { status: 400 },
    );
  }

  const now = new Date();
  const nextStatus = body.status;

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
          description: project.description,
          codeUrl: project.codeUrl,
          videoUrl: project.videoUrl,
          playableDemoUrl: project.playableDemoUrl,
          screenshots: project.screenshots,
          submittedAt: project.submittedAt,
          creatorName: user.name,
          creatorEmail: user.email,
          creatorSlackId: user.slackId,
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
          const reviews = await db
            .select({
              decision: peerReview.decision,
              reviewComment: peerReview.reviewComment,
              createdAt: peerReview.createdAt,
              reviewerName: user.name,
            })
            .from(peerReview)
            .leftJoin(user, eq(peerReview.reviewerId, user.id))
            .where(eq(peerReview.projectId, id))
            .orderBy(peerReview.createdAt);

          await createAirtableGrantRecord({
            project: {
              name: current.name,
              description: current.description,
              codeUrl: current.codeUrl,
              playableDemoUrl: current.playableDemoUrl,
              videoUrl: current.videoUrl,
              screenshots: current.screenshots ?? [],
              submittedAtIso: current.submittedAt ? current.submittedAt.toISOString() : null,
              approvedHours: current.approvedHours ?? null,
            },
            creator: {
              name: current.creatorName ?? "Unknown",
              email: current.creatorEmail ?? "",
              slackId: current.creatorSlackId ?? null,
              birthdayIso: current.creatorBirthday ?? null,
            },
            shipping: {
              addressLine1: current.addressLine1 ?? null,
              addressLine2: current.addressLine2 ?? null,
              city: current.city ?? null,
              stateProvince: current.stateProvince ?? null,
              country: current.country ?? null,
              zipPostalCode: current.zipPostalCode ?? null,
            },
            reviewStatus: "Approved",
            reviews: reviews.map((r) => ({
              reviewerName: r.reviewerName || "Unknown reviewer",
              decision: r.decision,
              message: r.reviewComment,
            })),
          });
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



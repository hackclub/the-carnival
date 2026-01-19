import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { project, tokenLedger, type ProjectStatus } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";
import { tokensForApprovedHours } from "@/lib/tokens";
import { generateId, isUniqueConstraintError } from "@/lib/api-utils";

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



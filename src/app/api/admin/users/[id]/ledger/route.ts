import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tokenLedger, user } from "@/db/schema";
import { appendAdminAudit } from "@/lib/admin-audit";
import { parseLedgerAdjustmentPayload } from "@/lib/admin-safety";
import { getAuthUser } from "@/lib/api-utils";
import { getLedgerForUser, getTokenBalance } from "@/lib/wallet";

function parseLimit(raw: string | null): number {
  const parsed = raw ? Number(raw) : 50;
  if (!Number.isFinite(parsed)) return 50;
  const asInt = Math.trunc(parsed);
  if (asInt < 1) return 1;
  if (asInt > 200) return 200;
  return asInt;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const currentUser = await getAuthUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!currentUser.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: targetUserId } = await ctx.params;

  const targetRows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isFrozen: user.isFrozen,
      frozenReason: user.frozenReason,
      frozenAt: user.frozenAt,
    })
    .from(user)
    .where(eq(user.id, targetUserId))
    .limit(1);

  const target = targetRows[0];
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const url = new URL(req.url);
  const limit = parseLimit(url.searchParams.get("limit"));

  const [balance, ledger] = await Promise.all([
    getTokenBalance(db, targetUserId),
    getLedgerForUser(db, targetUserId, limit),
  ]);

  return NextResponse.json({
    user: {
      ...target,
      frozenAt: target.frozenAt ? target.frozenAt.toISOString() : null,
    },
    balance,
    ledger: ledger.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const currentUser = await getAuthUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!currentUser.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: targetUserId } = await ctx.params;

  const targetRows = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.id, targetUserId))
    .limit(1);

  const target = targetRows[0];
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseLedgerAdjustmentPayload(payload);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const now = new Date();
  const referenceId = randomUUID();

  const result = await db.transaction(async (tx) => {
    const balanceBefore = await getTokenBalance(tx, targetUserId);

    if (parsed.value.kind === "deduct" && balanceBefore < parsed.value.amount) {
      return { kind: "error" as const, status: 409 as const, error: "Insufficient tokens for deduction" };
    }

    const entryId = randomUUID();
    await tx.insert(tokenLedger).values({
      id: entryId,
      kind: parsed.value.kind,
      tokens: parsed.value.amount,
      reason: parsed.value.reason,
      issuedToUserId: targetUserId,
      byUserId: currentUser.id,
      referenceType: "admin_adjustment",
      referenceId,
      createdAt: now,
    });

    await appendAdminAudit(
      {
        actorId: currentUser.id,
        actorRole: "admin",
        action: "ledger_adjustment_created",
        targetUserId,
        details: {
          type: parsed.value.kind,
          amount: parsed.value.amount,
          reason: parsed.value.reason,
          referenceType: "admin_adjustment",
          referenceId,
          targetRole: target.role,
        },
        at: now,
      },
      tx,
    );

    const balanceAfter =
      parsed.value.kind === "issue"
        ? balanceBefore + parsed.value.amount
        : balanceBefore - parsed.value.amount;

    return {
      kind: "ok" as const,
      adjustment: {
        id: entryId,
        kind: parsed.value.kind,
        tokens: parsed.value.amount,
        reason: parsed.value.reason,
        byUserId: currentUser.id,
        createdAt: now.toISOString(),
      },
      balanceBefore,
      balanceAfter,
    };
  });

  if (result.kind === "error") {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result, { status: 201 });
}

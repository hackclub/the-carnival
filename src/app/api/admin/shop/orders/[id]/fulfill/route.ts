import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { shopOrder, tokenLedger } from "@/db/schema";
import { getAuthUser, parseJsonBody, toCleanString, toPositiveInt, generateId } from "@/lib/api-utils";
import { getTokenBalance } from "@/lib/wallet";

type FulfillBody = {
  fulfillmentLink?: unknown;
  deductTokensOverride?: unknown;
  deductTokensOverrideNote?: unknown;
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getAuthUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!admin.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = await parseJsonBody<FulfillBody>(req);
  const fulfillmentLink = toCleanString(body?.fulfillmentLink);
  if (!fulfillmentLink) return NextResponse.json({ error: "fulfillmentLink is required" }, { status: 400 });
  const rawOverride =
    typeof body?.deductTokensOverride === "string" ? body.deductTokensOverride.trim() : body?.deductTokensOverride;
  const overrideNote = toCleanString(body?.deductTokensOverrideNote);
  const hasOverride = rawOverride !== undefined && rawOverride !== null && rawOverride !== "";
  let deductTokensOverride: number | null = null;
  if (hasOverride) {
    const parsed = toPositiveInt(rawOverride);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return NextResponse.json(
        { error: "deductTokensOverride must be a non-negative integer" },
        { status: 400 },
      );
    }
    if (!overrideNote) {
      return NextResponse.json(
        { error: "deductTokensOverrideNote is required when overriding token deduction" },
        { status: 400 },
      );
    }
    deductTokensOverride = parsed;
  }

  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: shopOrder.id,
        userId: shopOrder.userId,
        status: shopOrder.status,
        itemName: shopOrder.itemNameSnapshot,
        tokenCost: shopOrder.tokenCostSnapshot,
        fulfillmentLink: shopOrder.fulfillmentLink,
      })
      .from(shopOrder)
      .where(eq(shopOrder.id, id))
      .limit(1);

    const order = rows[0];
    if (!order) return { error: "Not found" as const, status: 404 as const };

    if (order.status === "fulfilled") {
      return { ok: true as const };
    }
    if (order.status !== "pending") {
      return { error: "Order is not pending" as const, status: 409 as const };
    }

    const balance = await getTokenBalance(tx, order.userId);
    const cost = hasOverride ? (deductTokensOverride ?? 0) : (order.tokenCost ?? 0);
    if (balance < cost) {
      return { error: "User has insufficient tokens to fulfill this order" as const, status: 409 as const };
    }

    const defaultCost = order.tokenCost ?? 0;
    const reason = hasOverride
      ? `Deducted ${cost} tokens for purchasing ${order.itemName} from the shop (manual override; default cost ${defaultCost}). Override note: ${overrideNote}. Fulfilled with ${fulfillmentLink}.`
      : `Deducted ${cost} tokens for purchasing ${order.itemName} from the shop. ${order.itemName} cost ${cost} tokens. Fulfilled with ${fulfillmentLink}.`;

    await tx
      .insert(tokenLedger)
      .values({
        id: generateId(),
        kind: "deduct",
        tokens: cost,
        reason,
        issuedToUserId: order.userId,
        byUserId: admin.id,
        referenceType: "shop_order",
        referenceId: order.id,
        createdAt: now,
      })
      .onConflictDoNothing({
        target: [tokenLedger.referenceType, tokenLedger.referenceId, tokenLedger.kind],
      });

    const updated = await tx
      .update(shopOrder)
      .set({
        status: "fulfilled",
        fulfillmentLink,
        fulfilledById: admin.id,
        fulfilledAt: now,
        updatedAt: now,
      })
      .where(and(eq(shopOrder.id, id), eq(shopOrder.status, "pending")))
      .returning({ id: shopOrder.id });

    if (!updated[0]) {
      return { error: "Failed to fulfill order" as const, status: 409 as const };
    }

    return { ok: true as const };
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}


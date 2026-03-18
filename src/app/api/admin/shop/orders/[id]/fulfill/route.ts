import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { shopOrder, tokenLedger, user } from "@/db/schema";
import { getAuthUser, parseJsonBody, toCleanString, toPositiveInt, generateId } from "@/lib/api-utils";
import { getAppBaseUrl, sendShopOrderFulfilledParticipantEmail } from "@/lib/loops";
import { getTokenBalance } from "@/lib/wallet";

type FulfillBody = {
  fulfillmentLink?: unknown;
  deductTokensOverride?: unknown;
  deductTokensOverrideNote?: unknown;
};

type FulfillTransactionResult =
  | {
      kind: "error";
      error: string;
      status: number;
    }
  | {
      kind: "already_fulfilled";
    }
  | {
      kind: "fulfilled";
      email: {
        participantEmail: string;
        participantName: string;
        orderId: string;
        itemName: string;
        fulfillmentLink: string;
        fulfilledAt: string;
        tokensDeducted: number;
        tokenCostSnapshot: number;
      };
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
    const overrideString = String(rawOverride);
    if (!/^\d+$/.test(overrideString)) {
      return NextResponse.json(
        { error: "deductTokensOverride must be a non-negative integer" },
        { status: 400 },
      );
    }
    const parsed = toPositiveInt(overrideString);
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

  const result = await db.transaction<FulfillTransactionResult>(async (tx) => {
    const rows = await tx
      .select({
        id: shopOrder.id,
        userId: shopOrder.userId,
        status: shopOrder.status,
        itemName: shopOrder.itemNameSnapshot,
        tokenCost: shopOrder.tokenCostSnapshot,
        participantName: user.name,
        participantEmail: user.email,
      })
      .from(shopOrder)
      .leftJoin(user, eq(shopOrder.userId, user.id))
      .where(eq(shopOrder.id, id))
      .limit(1);

    const order = rows[0];
    if (!order) {
      return { kind: "error", error: "Not found", status: 404 };
    }

    if (order.status === "fulfilled") {
      return { kind: "already_fulfilled" };
    }
    if (order.status !== "pending") {
      return { kind: "error", error: "Order is not pending", status: 409 };
    }

    const balance = await getTokenBalance(tx, order.userId);
    const cost = hasOverride ? (deductTokensOverride ?? 0) : (order.tokenCost ?? 0);
    if (balance < cost) {
      return {
        kind: "error",
        error: `Cannot deduct ${cost} tokens because user only has ${balance} available`,
        status: 409,
      };
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
      return { kind: "error", error: "Failed to fulfill order", status: 409 };
    }

    return {
      kind: "fulfilled",
      email: {
        participantEmail: order.participantEmail ?? "",
        participantName: order.participantName ?? order.userId,
        orderId: order.id,
        itemName: order.itemName,
        fulfillmentLink,
        fulfilledAt: now.toISOString(),
        tokensDeducted: cost,
        tokenCostSnapshot: order.tokenCost ?? 0,
      },
    };
  });

  if (result.kind === "error") {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (result.kind === "fulfilled" && result.email.participantEmail) {
    await sendShopOrderFulfilledParticipantEmail(result.email.participantEmail, {
      participant_name: result.email.participantName,
      order_id: result.email.orderId,
      item_name: result.email.itemName,
      fulfillment_link: result.email.fulfillmentLink,
      fulfilled_at: result.email.fulfilledAt,
      tokens_deducted: result.email.tokensDeducted,
      token_cost_snapshot: result.email.tokenCostSnapshot,
      shop_url: `${getAppBaseUrl()}/shop`,
    });
  }

  return NextResponse.json({ ok: true });
}

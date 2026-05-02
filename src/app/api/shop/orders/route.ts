import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { shopItem, shopOrder, user } from "@/db/schema";
import { generateId, getAuthUser, parseJsonBody, toCleanString } from "@/lib/api-utils";
import { getFrozenAccountMessage, getFrozenAccountState } from "@/lib/frozen-account";
import { getAppBaseUrl, sendShopOrderCreatedAdminEmail } from "@/lib/loops";
import { calculateShopOrderTotal, parseShopOrderQuantity } from "@/lib/shop";
import { getTokenBalance } from "@/lib/wallet";

type CreateOrderBody = {
  itemId?: unknown;
  orderNote?: unknown;
  quantity?: unknown;
};

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orders = await db
    .select({
      id: shopOrder.id,
      status: shopOrder.status,
      shopItemId: shopOrder.shopItemId,
      itemName: shopOrder.itemNameSnapshot,
      itemImageUrl: shopOrder.itemImageSnapshot,
      itemDescription: shopOrder.itemDescriptionSnapshot,
      orderNote: shopOrder.orderNote,
      quantity: shopOrder.quantity,
      unitTokenCost: shopOrder.unitTokenCostSnapshot,
      tokenCost: shopOrder.tokenCostSnapshot,
      fulfillmentLink: shopOrder.fulfillmentLink,
      cancellationReason: shopOrder.cancellationReason,
      cancelledAt: shopOrder.cancelledAt,
      fulfilledAt: shopOrder.fulfilledAt,
      createdAt: shopOrder.createdAt,
    })
    .from(shopOrder)
    .where(eq(shopOrder.userId, authUser.id))
    .orderBy(desc(shopOrder.createdAt));

  return NextResponse.json({
    orders: orders.map((o) => ({
      ...o,
      itemDescription: o.itemDescription ?? null,
      orderNote: o.orderNote ?? null,
      cancellationReason: o.cancellationReason ?? null,
      cancelledAt: o.cancelledAt ? o.cancelledAt.toISOString() : null,
      fulfilledAt: o.fulfilledAt ? o.fulfilledAt.toISOString() : null,
      createdAt: o.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const freezeState = await getFrozenAccountState(authUser.id);
  if (freezeState.isFrozen) {
    return NextResponse.json(
      {
        error: getFrozenAccountMessage(freezeState.frozenReason),
        code: "account_frozen",
      },
      { status: 403 },
    );
  }

  const body = await parseJsonBody<CreateOrderBody>(req);
  const itemId = toCleanString(body?.itemId);
  if (!itemId) return NextResponse.json({ error: "itemId is required" }, { status: 400 });
  if (body?.orderNote !== undefined && body?.orderNote !== null && typeof body.orderNote !== "string") {
    return NextResponse.json({ error: "orderNote must be a string" }, { status: 400 });
  }
  const orderNote = toCleanString(body?.orderNote);
  const quantity = parseShopOrderQuantity(body?.quantity);
  if (quantity === null) {
    return NextResponse.json(
      { error: "Quantity must be a whole number between 1 and 99." },
      { status: 400 },
    );
  }

  const rows = await db
    .select({
      id: shopItem.id,
      name: shopItem.name,
      imageUrl: shopItem.imageUrl,
      description: shopItem.description,
      orderNoteRequired: shopItem.orderNoteRequired,
      tokenCost: shopItem.tokenCost,
    })
    .from(shopItem)
    .where(eq(shopItem.id, itemId))
    .limit(1);

  const item = rows[0];
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  if (item.orderNoteRequired && !orderNote) {
    return NextResponse.json({ error: "A request note is required for this item." }, { status: 400 });
  }

  const balance = await getTokenBalance(db, authUser.id);
  if (balance <= 0) {
    return NextResponse.json({ error: "You must have tokens to place an order" }, { status: 409 });
  }
  const unitTokenCost = item.tokenCost ?? 0;
  const totalTokenCost = calculateShopOrderTotal(unitTokenCost, quantity);
  if (balance < totalTokenCost) {
    return NextResponse.json({ error: "Insufficient tokens" }, { status: 409 });
  }

  const now = new Date();
  const id = generateId();

  await db.insert(shopOrder).values({
    id,
    userId: authUser.id,
    status: "pending",
    shopItemId: item.id,
    itemNameSnapshot: item.name,
    itemImageSnapshot: item.imageUrl,
    itemDescriptionSnapshot: item.description ?? null,
    orderNote: orderNote || null,
    quantity,
    unitTokenCostSnapshot: unitTokenCost,
    tokenCostSnapshot: totalTokenCost,
    createdAt: now,
    updatedAt: now,
  });

  try {
    const [participantRows, adminRows] = await Promise.all([
      db
        .select({
          name: user.name,
          email: user.email,
        })
        .from(user)
        .where(eq(user.id, authUser.id))
        .limit(1),
      db
        .select({
          email: user.email,
        })
        .from(user)
        .where(eq(user.role, "admin")),
    ]);

    const participant = participantRows[0];
    const participantName = participant?.name ?? authUser.id;
    const participantEmail = participant?.email ?? "";
    const adminOrdersUrl = `${getAppBaseUrl()}/admin/orders?status=pending`;

    await Promise.all(
      adminRows
        .map((row) => row.email.trim())
        .filter(Boolean)
        .map((targetEmail) =>
          sendShopOrderCreatedAdminEmail(targetEmail, {
            order_id: id,
            participant_name: participantName,
            participant_email: participantEmail,
            item_name: item.name,
            item_description: item.description ?? "",
            item_image_url: item.imageUrl,
            token_cost: totalTokenCost,
            created_at: now.toISOString(),
            admin_orders_url: adminOrdersUrl,
            order_note: orderNote
              ? `Quantity: ${quantity}. ${orderNote}`
              : `Quantity: ${quantity}.`,
          }),
        ),
    );
  } catch (err) {
    console.warn("Failed to send shop order created admin emails", err);
  }

  return NextResponse.json({ id }, { status: 201 });
}

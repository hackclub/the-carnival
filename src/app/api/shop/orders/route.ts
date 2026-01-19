import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { shopItem, shopOrder } from "@/db/schema";
import { getAuthUser, parseJsonBody, toCleanString } from "@/lib/api-utils";
import { getTokenBalance } from "@/lib/wallet";
import { generateId } from "@/lib/api-utils";

type CreateOrderBody = {
  itemId?: unknown;
};

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orders = await db
    .select({
      id: shopOrder.id,
      status: shopOrder.status,
      shopItemId: shopOrder.shopItemId,
      itemName: shopOrder.itemNameSnapshot,
      itemImageUrl: shopOrder.itemImageSnapshot,
      tokenCost: shopOrder.tokenCostSnapshot,
      fulfillmentLink: shopOrder.fulfillmentLink,
      fulfilledAt: shopOrder.fulfilledAt,
      createdAt: shopOrder.createdAt,
    })
    .from(shopOrder)
    .where(eq(shopOrder.userId, user.id))
    .orderBy(desc(shopOrder.createdAt));

  return NextResponse.json({
    orders: orders.map((o) => ({
      ...o,
      fulfilledAt: o.fulfilledAt ? o.fulfilledAt.toISOString() : null,
      createdAt: o.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await parseJsonBody<CreateOrderBody>(req);
  const itemId = toCleanString(body?.itemId);
  if (!itemId) return NextResponse.json({ error: "itemId is required" }, { status: 400 });

  const rows = await db
    .select({
      id: shopItem.id,
      name: shopItem.name,
      imageUrl: shopItem.imageUrl,
      tokenCost: shopItem.tokenCost,
    })
    .from(shopItem)
    .where(eq(shopItem.id, itemId))
    .limit(1);

  const item = rows[0];
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const balance = await getTokenBalance(db, user.id);
  if (balance < (item.tokenCost ?? 0)) {
    return NextResponse.json({ error: "Insufficient tokens" }, { status: 409 });
  }

  const now = new Date();
  const id = generateId();

  await db.insert(shopOrder).values({
    id,
    userId: user.id,
    status: "pending",
    shopItemId: item.id,
    itemNameSnapshot: item.name,
    itemImageSnapshot: item.imageUrl,
    tokenCostSnapshot: item.tokenCost ?? 0,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id }, { status: 201 });
}


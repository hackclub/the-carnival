import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { shopOrder } from "@/db/schema";
import { getAuthUser } from "@/lib/api-utils";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orders = await db
    .select({
      id: shopOrder.id,
      userId: shopOrder.userId,
      status: shopOrder.status,
      shopItemId: shopOrder.shopItemId,
      itemName: shopOrder.itemNameSnapshot,
      itemImageUrl: shopOrder.itemImageSnapshot,
      itemDescription: shopOrder.itemDescriptionSnapshot,
      tokenCost: shopOrder.tokenCostSnapshot,
      fulfillmentLink: shopOrder.fulfillmentLink,
      cancellationReason: shopOrder.cancellationReason,
      cancelledById: shopOrder.cancelledById,
      cancelledAt: shopOrder.cancelledAt,
      fulfilledById: shopOrder.fulfilledById,
      fulfilledAt: shopOrder.fulfilledAt,
      createdAt: shopOrder.createdAt,
      updatedAt: shopOrder.updatedAt,
    })
    .from(shopOrder)
    .orderBy(desc(shopOrder.createdAt));

  return NextResponse.json({
    orders: orders.map((o) => ({
      ...o,
      itemDescription: o.itemDescription ?? null,
      cancellationReason: o.cancellationReason ?? null,
      cancelledById: o.cancelledById ?? null,
      cancelledAt: o.cancelledAt ? o.cancelledAt.toISOString() : null,
      fulfilledAt: o.fulfilledAt ? o.fulfilledAt.toISOString() : null,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    })),
  });
}


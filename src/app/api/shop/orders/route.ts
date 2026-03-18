import { NextResponse } from "next/server";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { shopItem, shopOrder, user as dbUser } from "@/db/schema";
import { generateId, getAuthUser, parseJsonBody, toCleanString } from "@/lib/api-utils";
import { getTokenBalance } from "@/lib/wallet";
import { sendShopOrderCreatedEmail } from "@/lib/loops";

type CreateOrderBody = {
  itemId?: unknown;
  orderNote?: unknown;
};

function toAbsoluteAppUrl(path: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (!appUrl) return path;
  try {
    return new URL(path, appUrl).toString();
  } catch {
    return path;
  }
}

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
      itemDescription: shopOrder.itemDescriptionSnapshot,
      orderNote: shopOrder.orderNote,
      tokenCost: shopOrder.tokenCostSnapshot,
      fulfillmentLink: shopOrder.fulfillmentLink,
      cancellationReason: shopOrder.cancellationReason,
      cancelledAt: shopOrder.cancelledAt,
      fulfilledAt: shopOrder.fulfilledAt,
      createdAt: shopOrder.createdAt,
    })
    .from(shopOrder)
    .where(eq(shopOrder.userId, user.id))
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
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await parseJsonBody<CreateOrderBody>(req);
  const itemId = toCleanString(body?.itemId);
  if (!itemId) return NextResponse.json({ error: "itemId is required" }, { status: 400 });
  if (body?.orderNote !== undefined && body?.orderNote !== null && typeof body.orderNote !== "string") {
    return NextResponse.json({ error: "orderNote must be a string" }, { status: 400 });
  }
  const orderNote = toCleanString(body?.orderNote);

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

  const balance = await getTokenBalance(db, user.id);
  if (balance <= 0) {
    return NextResponse.json({ error: "You must have tokens to place an order" }, { status: 409 });
  }
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
    itemDescriptionSnapshot: item.description ?? null,
    orderNote: orderNote || null,
    tokenCostSnapshot: item.tokenCost ?? 0,
    createdAt: now,
    updatedAt: now,
  });

  const requesterRows = await db
    .select({ name: dbUser.name, email: dbUser.email })
    .from(dbUser)
    .where(eq(dbUser.id, user.id))
    .limit(1);
  const requesterName = requesterRows[0]?.name ?? "User";
  const requesterEmail = requesterRows[0]?.email ?? "";

  const adminRows = await db
    .select({ email: dbUser.email })
    .from(dbUser)
    .where(and(eq(dbUser.role, "admin"), ne(dbUser.email, "")));

  if (adminRows.length > 0) {
    const adminOrdersLink = toAbsoluteAppUrl("/admin/orders");
    await Promise.allSettled(
      adminRows.map((adminRow) =>
        sendShopOrderCreatedEmail(adminRow.email, {
          orderId: id,
          itemName: item.name,
          requesterName,
          requesterEmail,
          orderNote: orderNote || null,
          tokenCost: item.tokenCost ?? 0,
          adminOrdersLink,
        }),
      ),
    );
  }

  return NextResponse.json({ id }, { status: 201 });
}

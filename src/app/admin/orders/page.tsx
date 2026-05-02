import { redirect } from "next/navigation";
import { desc, eq, inArray, sql } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import AdminOrdersClient, { type AdminShopOrderDTO } from "@/components/AdminOrdersClient";
import { db } from "@/db";
import { shopItem, shopOrder, tokenLedger, user } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

export default async function AdminOrdersPage() {
  const session = await getServerSession({ disableCookieCache: true });
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  const isAdmin = role === "admin";
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/orders");
  if (!isAdmin) redirect("/projects");

  const orders = await db
    .select({
      id: shopOrder.id,
      userId: shopOrder.userId,
      requesterName: user.name,
      requesterEmail: user.email,
      status: shopOrder.status,
      itemName: shopOrder.itemNameSnapshot,
      itemImageUrl: shopOrder.itemImageSnapshot,
      itemDescription: shopOrder.itemDescriptionSnapshot,
      orderNote: shopOrder.orderNote,
      currentItemDescription: shopItem.description,
      quantity: shopOrder.quantity,
      unitTokenCost: shopOrder.unitTokenCostSnapshot,
      tokenCost: shopOrder.tokenCostSnapshot,
      fulfillmentLink: shopOrder.fulfillmentLink,
      cancellationReason: shopOrder.cancellationReason,
      cancelledAt: shopOrder.cancelledAt,
      createdAt: shopOrder.createdAt,
      fulfilledAt: shopOrder.fulfilledAt,
    })
    .from(shopOrder)
    .leftJoin(shopItem, eq(shopOrder.shopItemId, shopItem.id))
    .leftJoin(user, eq(shopOrder.userId, user.id))
    .orderBy(desc(shopOrder.createdAt));

  const orderUserIds = Array.from(new Set(orders.map((o) => o.userId)));
  const tokenBalances = orderUserIds.length > 0
    ? await db
        .select({
          userId: tokenLedger.issuedToUserId,
          balance: sql<number>`coalesce(sum(case when ${tokenLedger.kind} = 'issue' then ${tokenLedger.tokens} else -${tokenLedger.tokens} end), 0)`,
        })
        .from(tokenLedger)
        .where(inArray(tokenLedger.issuedToUserId, orderUserIds))
        .groupBy(tokenLedger.issuedToUserId)
    : [];
  const balanceByUserId = new Map(tokenBalances.map((row) => [row.userId, Number(row.balance ?? 0)]));

  const initialOrders: AdminShopOrderDTO[] = orders.map((o) => ({
    id: o.id,
    userId: o.userId,
    requesterName: o.requesterName ?? o.userId,
    requesterEmail: o.requesterEmail ?? null,
    requesterTokenBalance: balanceByUserId.get(o.userId) ?? 0,
    status: o.status,
    itemName: o.itemName,
    itemImageUrl: o.itemImageUrl,
    itemDescription: o.itemDescription ?? o.currentItemDescription ?? null,
    orderNote: o.orderNote ?? null,
    quantity: o.quantity ?? 1,
    unitTokenCost: o.unitTokenCost ?? o.tokenCost ?? 0,
    tokenCost: o.tokenCost ?? 0,
    fulfillmentLink: o.fulfillmentLink ?? null,
    cancellationReason: o.cancellationReason ?? null,
    cancelledAt: o.cancelledAt ? o.cancelledAt.toISOString() : null,
    createdAt: o.createdAt.toISOString(),
    fulfilledAt: o.fulfilledAt ? o.fulfilledAt.toISOString() : null,
  }));

  return (
    <AppShell title="Orders">
      <div className="mb-6">
        <div className="text-muted-foreground">Manage and fulfill shop orders.</div>
      </div>

      <AdminOrdersClient initial={{ orders: initialOrders }} />
    </AppShell>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, inArray, sql } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import AdminShopClient, { type AdminShopItemDTO, type AdminShopOrderDTO } from "@/components/AdminShopClient";
import { db } from "@/db";
import { shopItem, shopOrder, tokenLedger, user } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

export default async function AdminShopPage() {
  const session = await getServerSession({ disableCookieCache: true });
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  const canManageShopItems = role === "reviewer" || role === "admin";
  const isAdmin = role === "admin";
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/shop");
  if (!canManageShopItems) redirect("/projects");

  const items = await db
    .select({
      id: shopItem.id,
      name: shopItem.name,
      description: shopItem.description,
      imageUrl: shopItem.imageUrl,
      approvedHoursNeeded: shopItem.approvedHoursNeeded,
      tokenCost: shopItem.tokenCost,
      createdAt: shopItem.createdAt,
      updatedAt: shopItem.updatedAt,
    })
    .from(shopItem);

  const orders = isAdmin
    ? await db
        .select({
          id: shopOrder.id,
          userId: shopOrder.userId,
          requesterName: user.name,
          status: shopOrder.status,
          itemName: shopOrder.itemNameSnapshot,
          tokenCost: shopOrder.tokenCostSnapshot,
          fulfillmentLink: shopOrder.fulfillmentLink,
          createdAt: shopOrder.createdAt,
          fulfilledAt: shopOrder.fulfilledAt,
        })
        .from(shopOrder)
        .leftJoin(user, eq(shopOrder.userId, user.id))
        .orderBy(desc(shopOrder.createdAt))
    : [];

  const orderUserIds = Array.from(new Set(orders.map((o) => o.userId)));
  const tokenBalances = isAdmin && orderUserIds.length > 0
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

  const initialItems: AdminShopItemDTO[] = items.map((i) => ({
    id: i.id,
    name: i.name,
    description: i.description ?? null,
    imageUrl: i.imageUrl,
    approvedHoursNeeded: i.approvedHoursNeeded ?? 0,
    tokenCost: i.tokenCost ?? 0,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  }));

  const initialOrders: AdminShopOrderDTO[] = orders.map((o) => ({
    id: o.id,
    userId: o.userId,
    requesterName: o.requesterName ?? o.userId,
    requesterTokenBalance: balanceByUserId.get(o.userId) ?? 0,
    status: o.status,
    itemName: o.itemName,
    tokenCost: o.tokenCost ?? 0,
    fulfillmentLink: o.fulfillmentLink ?? null,
    createdAt: o.createdAt.toISOString(),
    fulfilledAt: o.fulfilledAt ? o.fulfilledAt.toISOString() : null,
  }));

  return (
    <AppShell title="Shop (Staff)">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="text-muted-foreground">Create/edit items and fulfill orders.</div>
        <Link
          href="/admin/shop/items/new"
          className="bg-carnival-blue/20 hover:bg-carnival-blue/30 text-foreground px-5 py-3 rounded-full font-semibold transition-colors border border-border"
        >
          New item
        </Link>
      </div>

      <AdminShopClient initial={{ items: initialItems, orders: initialOrders }} canManageOrders={isAdmin} />
    </AppShell>
  );
}


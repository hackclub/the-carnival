import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { desc, eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import ShopClient, { type ShopItemDTO, type ShopLedgerDTO, type ShopOrderDTO } from "@/components/ShopClient";
import { db } from "@/db";
import { shopItem, shopOrder } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";
import { getLedgerForUser, getTokenBalance } from "@/lib/wallet";

export default async function ShopPage() {
  noStore();
  const session = await getServerSession({ disableCookieCache: true });
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login?callbackUrl=/shop");

  const [items, orders, balance, ledger] = await Promise.all([
    db
      .select({
        id: shopItem.id,
        name: shopItem.name,
        imageUrl: shopItem.imageUrl,
        approvedHoursNeeded: shopItem.approvedHoursNeeded,
        tokenCost: shopItem.tokenCost,
      })
      .from(shopItem),
    db
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
      .where(eq(shopOrder.userId, userId))
      .orderBy(desc(shopOrder.createdAt)),
    getTokenBalance(db, userId),
    getLedgerForUser(db, userId, 50),
  ]);

  const initialItems: ShopItemDTO[] = items.map((i) => ({
    id: i.id,
    name: i.name,
    imageUrl: i.imageUrl,
    approvedHoursNeeded: i.approvedHoursNeeded ?? 0,
    tokenCost: i.tokenCost ?? 0,
  }));

  const initialOrders: ShopOrderDTO[] = orders.map((o) => ({
    id: o.id,
    status: o.status,
    shopItemId: o.shopItemId,
    itemName: o.itemName,
    itemImageUrl: o.itemImageUrl,
    tokenCost: o.tokenCost ?? 0,
    fulfillmentLink: o.fulfillmentLink ?? null,
    fulfilledAt: o.fulfilledAt ? o.fulfilledAt.toISOString() : null,
    createdAt: o.createdAt.toISOString(),
  }));

  const initialLedger: ShopLedgerDTO[] = ledger.map((l) => ({
    id: l.id,
    kind: l.kind,
    tokens: l.tokens,
    reason: l.reason,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <AppShell title="Shop">
      <ShopClient initial={{ balance, items: initialItems, orders: initialOrders, ledger: initialLedger }} />
    </AppShell>
  );
}


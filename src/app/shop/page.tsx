import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { desc, eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import ShopClient, { type ShopItemDTO, type ShopLedgerDTO, type ShopOrderDTO } from "@/components/ShopClient";
import { db } from "@/db";
import { shopItem, shopItemSuggestion, shopOrder } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";
import { getLedgerForUser, getTokenBalance } from "@/lib/wallet";

export default async function ShopPage() {
  noStore();
  const session = await getServerSession({ disableCookieCache: true });
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login?callbackUrl=/shop");

  const role = (session?.user as { role?: unknown } | undefined)?.role;
  const isAdmin = role === "admin";

  const [items, orders, suggestions, balance, ledgerRows] = await Promise.all([
    db
      .select({
        id: shopItem.id,
        name: shopItem.name,
        description: shopItem.description,
        imageUrl: shopItem.imageUrl,
        orderNoteRequired: shopItem.orderNoteRequired,
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
        orderNote: shopOrder.orderNote,
        quantity: shopOrder.quantity,
        unitTokenCost: shopOrder.unitTokenCostSnapshot,
        tokenCost: shopOrder.tokenCostSnapshot,
        fulfillmentLink: shopOrder.fulfillmentLink,
        fulfilledAt: shopOrder.fulfilledAt,
        createdAt: shopOrder.createdAt,
      })
      .from(shopOrder)
      .where(eq(shopOrder.userId, userId))
      .orderBy(desc(shopOrder.createdAt)),
    db
      .select({
        id: shopItemSuggestion.id,
        status: shopItemSuggestion.status,
        name: shopItemSuggestion.name,
        description: shopItemSuggestion.description,
        imageUrl: shopItemSuggestion.imageUrl,
        referenceUrl: shopItemSuggestion.referenceUrl,
        orderNoteRequired: shopItemSuggestion.orderNoteRequired,
        approvedHoursNeeded: shopItemSuggestion.approvedHoursNeeded,
        tokenCost: shopItemSuggestion.tokenCost,
        rejectionReason: shopItemSuggestion.rejectionReason,
        approvedShopItemId: shopItemSuggestion.approvedShopItemId,
        createdAt: shopItemSuggestion.createdAt,
      })
      .from(shopItemSuggestion)
      .where(eq(shopItemSuggestion.submittedByUserId, userId))
      .orderBy(desc(shopItemSuggestion.createdAt)),
    getTokenBalance(db, userId),
    isAdmin ? getLedgerForUser(db, userId, 50) : Promise.resolve([]),
  ]);

  // Map the raw DB shop items to their client Data Transfer Object (DTO) format for initial state hydration
  const initialItems: ShopItemDTO[] = items.map((i) => ({
    id: i.id,
    name: i.name,
    description: i.description ?? null,
    imageUrl: i.imageUrl,
    orderNoteRequired: i.orderNoteRequired ?? false,
    approvedHoursNeeded: i.approvedHoursNeeded ?? 0,
    tokenCost: i.tokenCost ?? 0,
  }));

  const initialOrders: ShopOrderDTO[] = orders.map((o) => ({
    id: o.id,
    status: o.status,
    shopItemId: o.shopItemId,
    itemName: o.itemName,
    itemImageUrl: o.itemImageUrl,
    orderNote: o.orderNote ?? null,
    quantity: o.quantity ?? 1,
    unitTokenCost: o.unitTokenCost ?? o.tokenCost ?? 0,
    tokenCost: o.tokenCost ?? 0,
    fulfillmentLink: o.fulfillmentLink ?? null,
    fulfilledAt: o.fulfilledAt ? o.fulfilledAt.toISOString() : null,
    createdAt: o.createdAt.toISOString(),
  }));

  const initialLedger: ShopLedgerDTO[] = isAdmin
    ? ledgerRows.map((l) => ({
        id: l.id,
        kind: l.kind,
        tokens: l.tokens,
        reason: l.reason,
        createdAt: l.createdAt.toISOString(),
      }))
    : [];

  return (
    <AppShell title="Shop">
      <ShopClient
        canViewLedger={isAdmin}
        initial={{
          balance,
          items: initialItems,
          orders: initialOrders,
          ledger: initialLedger,
          suggestions: suggestions.map((s) => ({
            id: s.id,
            status: s.status,
            name: s.name,
            description: s.description ?? null,
            imageUrl: s.imageUrl ?? null,
            referenceUrl: s.referenceUrl ?? null,
            orderNoteRequired: s.orderNoteRequired,
            approvedHoursNeeded: s.approvedHoursNeeded,
            tokenCost: s.tokenCost,
            rejectionReason: s.rejectionReason ?? null,
            approvedShopItemId: s.approvedShopItemId ?? null,
            createdAt: s.createdAt.toISOString(),
          })),
        }}
      />
    </AppShell>
  );
}

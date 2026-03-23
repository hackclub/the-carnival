import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { desc, eq } from "drizzle-orm";
import Image from "next/image";
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

  const role = (session?.user as { role?: unknown } | undefined)?.role;
  const isAdmin = role === "admin";

  const [items, orders, balance, ledgerRows] = await Promise.all([
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
        tokenCost: shopOrder.tokenCostSnapshot,
        fulfillmentLink: shopOrder.fulfillmentLink,
        fulfilledAt: shopOrder.fulfilledAt,
        createdAt: shopOrder.createdAt,
      })
      .from(shopOrder)
      .where(eq(shopOrder.userId, userId))
      .orderBy(desc(shopOrder.createdAt)),
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
      <section className="carnival-panel relative mb-8 overflow-hidden px-5 py-6 sm:px-7 sm:py-8">
        <Image
          src="/left-ropes.png"
          alt=""
          width={248}
          height={463}
          className="pointer-events-none absolute -left-4 top-0 hidden h-auto w-16 opacity-75 sm:block"
        />
        <Image
          src="/right-ropes.png"
          alt=""
          width={233}
          height={375}
          className="pointer-events-none absolute -right-2 top-1 h-auto w-14 opacity-60 sm:w-16 sm:opacity-80"
        />
        <div className="relative z-10 max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8f4a18]">
            Prize Booth
          </p>
          <h2 className="mt-2 text-2xl font-black uppercase tracking-[0.06em] text-[#5b1f0a] [text-wrap:balance] sm:text-3xl">
            Spend your tokens on rewards and track every order.
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#6d3510] sm:text-base">
            Browse items, place requests, and follow fulfillment from the same midway view.
          </p>
        </div>
      </section>

      <ShopClient
        canViewLedger={isAdmin}
        initial={{ balance, items: initialItems, orders: initialOrders, ledger: initialLedger }}
      />
    </AppShell>
  );
}

import { redirect } from "next/navigation";
import { desc, eq, inArray, sql } from "drizzle-orm";
import Image from "next/image";
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
    tokenCost: o.tokenCost ?? 0,
    fulfillmentLink: o.fulfillmentLink ?? null,
    cancellationReason: o.cancellationReason ?? null,
    cancelledAt: o.cancelledAt ? o.cancelledAt.toISOString() : null,
    createdAt: o.createdAt.toISOString(),
    fulfilledAt: o.fulfilledAt ? o.fulfilledAt.toISOString() : null,
  }));

  return (
    <AppShell title="Orders">
      <section className="carnival-panel relative mb-8 overflow-hidden px-5 py-6 sm:px-7 sm:py-8">
        <Image
          src="/carousel.png"
          alt=""
          width={562}
          height={606}
          className="pointer-events-none absolute -right-8 -bottom-12 h-auto w-28 rotate-[6deg] opacity-35 sm:w-40 sm:opacity-60"
        />
        <div className="relative z-10 max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8f4a18]">
            Order Desk
          </p>
          <h2 className="mt-2 text-2xl font-black uppercase tracking-[0.06em] text-[#5b1f0a] [text-wrap:balance] sm:text-3xl">
            Review requests, fulfill fast, and keep order history clear.
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#6d3510] sm:text-base">
            Filter incoming requests, inspect details, and process fulfillment without leaving this page.
          </p>
        </div>
      </section>

      <AdminOrdersClient initial={{ orders: initialOrders }} />
    </AppShell>
  );
}

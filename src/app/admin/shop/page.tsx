import Link from "next/link";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import AdminShopClient, { type AdminShopItemDTO, type AdminShopOrderDTO } from "@/components/AdminShopClient";
import { db } from "@/db";
import { shopItem, shopOrder } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

export default async function AdminShopPage() {
  const session = await getServerSession({ disableCookieCache: true });
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/shop");
  if (role !== "admin") redirect("/projects");

  const [items, orders] = await Promise.all([
    db
      .select({
        id: shopItem.id,
        name: shopItem.name,
        imageUrl: shopItem.imageUrl,
        approvedHoursNeeded: shopItem.approvedHoursNeeded,
        tokenCost: shopItem.tokenCost,
        createdAt: shopItem.createdAt,
        updatedAt: shopItem.updatedAt,
      })
      .from(shopItem),
    db
      .select({
        id: shopOrder.id,
        userId: shopOrder.userId,
        status: shopOrder.status,
        itemName: shopOrder.itemNameSnapshot,
        tokenCost: shopOrder.tokenCostSnapshot,
        fulfillmentLink: shopOrder.fulfillmentLink,
        createdAt: shopOrder.createdAt,
        fulfilledAt: shopOrder.fulfilledAt,
      })
      .from(shopOrder)
      .orderBy(desc(shopOrder.createdAt)),
  ]);

  const initialItems: AdminShopItemDTO[] = items.map((i) => ({
    id: i.id,
    name: i.name,
    imageUrl: i.imageUrl,
    approvedHoursNeeded: i.approvedHoursNeeded ?? 0,
    tokenCost: i.tokenCost ?? 0,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  }));

  const initialOrders: AdminShopOrderDTO[] = orders.map((o) => ({
    id: o.id,
    userId: o.userId,
    status: o.status,
    itemName: o.itemName,
    tokenCost: o.tokenCost ?? 0,
    fulfillmentLink: o.fulfillmentLink ?? null,
    createdAt: o.createdAt.toISOString(),
    fulfilledAt: o.fulfilledAt ? o.fulfilledAt.toISOString() : null,
  }));

  return (
    <AppShell title="Shop (Admin)">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="text-muted-foreground">Create/edit items and fulfill orders.</div>
        <Link
          href="/admin/shop/items/new"
          className="bg-carnival-blue/20 hover:bg-carnival-blue/30 text-foreground px-5 py-3 rounded-full font-semibold transition-colors border border-border"
        >
          New item
        </Link>
      </div>

      <AdminShopClient initial={{ items: initialItems, orders: initialOrders }} />
    </AppShell>
  );
}


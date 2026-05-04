import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, inArray, sql } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import AdminShopClient, {
  type AdminShopItemDTO,
  type AdminShopOrderDTO,
  type AdminShopSuggestionDTO,
} from "@/components/AdminShopClient";
import { db } from "@/db";
import { shopItem, shopItemSuggestion, shopOrder, tokenLedger, user } from "@/db/schema";
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
      orderNoteRequired: shopItem.orderNoteRequired,
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
        .orderBy(desc(shopOrder.createdAt))
    : [];
  const suggestions = isAdmin
    ? await db
        .select({
          id: shopItemSuggestion.id,
          submittedByUserId: shopItemSuggestion.submittedByUserId,
          submitterName: user.name,
          submitterEmail: user.email,
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
          reviewedAt: shopItemSuggestion.reviewedAt,
        })
        .from(shopItemSuggestion)
        .leftJoin(user, eq(shopItemSuggestion.submittedByUserId, user.id))
        .orderBy(desc(shopItemSuggestion.createdAt))
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
    orderNoteRequired: i.orderNoteRequired ?? false,
    approvedHoursNeeded: i.approvedHoursNeeded ?? 0,
    tokenCost: i.tokenCost ?? 0,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  }));

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
  const initialSuggestions: AdminShopSuggestionDTO[] = suggestions.map((s) => ({
    id: s.id,
    submittedByUserId: s.submittedByUserId,
    submitterName: s.submitterName ?? s.submittedByUserId,
    submitterEmail: s.submitterEmail ?? null,
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
    reviewedAt: s.reviewedAt ? s.reviewedAt.toISOString() : null,
  }));

  return (
    <AppShell title="Shop (Staff)">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="text-muted-foreground">Create/edit items and fulfill orders.</div>
        <Link
          href="/admin/shop/items/new"
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--carnival-squircle-radius)] border-2 border-[var(--carnival-border)] bg-[#fff7dc] px-5 py-3 text-sm font-black uppercase tracking-[0.04em] text-foreground transition-colors hover:bg-[#fff0cf]"
        >
          New item
        </Link>
      </div>

      <AdminShopClient
        initial={{ items: initialItems, orders: initialOrders, suggestions: initialSuggestions }}
        canManageOrders={isAdmin}
      />
    </AppShell>
  );
}

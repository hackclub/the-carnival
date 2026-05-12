import { eq, sql } from "drizzle-orm";
import { type db as database } from "@/db";
import { project, shopItemSuggestion, shopOrder } from "@/db/schema";

export type AdminIndicatorCounts = {
  reviewQueue: number;
  grants: number;
  shopSuggestions: number;
  orders: number;
};

export async function getAdminIndicatorCounts(db: typeof database): Promise<AdminIndicatorCounts> {
  const [reviewQueueRow, grantsRow, shopSuggestionsRow, ordersRow] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(project)
      .where(eq(project.status, "in-review")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(project)
      .where(eq(project.status, "shipped")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(shopItemSuggestion)
      .where(eq(shopItemSuggestion.status, "pending")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(shopOrder)
      .where(eq(shopOrder.status, "pending")),
  ]);

  return {
    reviewQueue: Number(reviewQueueRow[0]?.count ?? 0),
    grants: Number(grantsRow[0]?.count ?? 0),
    shopSuggestions: Number(shopSuggestionsRow[0]?.count ?? 0),
    orders: Number(ordersRow[0]?.count ?? 0),
  };
}

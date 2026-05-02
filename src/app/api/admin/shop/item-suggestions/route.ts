import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { shopItemSuggestion, user } from "@/db/schema";
import { getAuthUser } from "@/lib/api-utils";
import { isShopItemSuggestionStatus } from "@/lib/shop-shared";

export async function GET(req: Request) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!authUser.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const whereClause = isShopItemSuggestionStatus(status)
    ? eq(shopItemSuggestion.status, status)
    : undefined;

  const rows = await db
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
      reviewedAt: shopItemSuggestion.reviewedAt,
      createdAt: shopItemSuggestion.createdAt,
      updatedAt: shopItemSuggestion.updatedAt,
    })
    .from(shopItemSuggestion)
    .leftJoin(user, eq(shopItemSuggestion.submittedByUserId, user.id))
    .where(whereClause)
    .orderBy(desc(shopItemSuggestion.createdAt));

  return NextResponse.json({
    suggestions: rows.map((row) => ({
      ...row,
      submitterName: row.submitterName ?? row.submittedByUserId,
      submitterEmail: row.submitterEmail ?? null,
      description: row.description ?? null,
      imageUrl: row.imageUrl ?? null,
      referenceUrl: row.referenceUrl ?? null,
      rejectionReason: row.rejectionReason ?? null,
      approvedShopItemId: row.approvedShopItemId ?? null,
      reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
  });
}

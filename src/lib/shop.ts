import { eq } from "drizzle-orm";
import { db } from "@/db";
import { shopItem, shopItemSuggestion } from "@/db/schema";
import { generateId } from "@/lib/api-utils";

export async function approveShopItemSuggestion(input: {
  suggestionId: string;
  adminUserId: string;
}) {
  const now = new Date();
  const createdItemId = generateId();

  return await db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: shopItemSuggestion.id,
        status: shopItemSuggestion.status,
        name: shopItemSuggestion.name,
        description: shopItemSuggestion.description,
        imageUrl: shopItemSuggestion.imageUrl,
        orderNoteRequired: shopItemSuggestion.orderNoteRequired,
        approvedHoursNeeded: shopItemSuggestion.approvedHoursNeeded,
        tokenCost: shopItemSuggestion.tokenCost,
      })
      .from(shopItemSuggestion)
      .where(eq(shopItemSuggestion.id, input.suggestionId))
      .limit(1);

    const suggestion = rows[0];
    if (!suggestion) return { ok: false as const, error: "Suggestion not found", status: 404 };
    if (suggestion.status !== "pending") {
      return { ok: false as const, error: "Suggestion has already been reviewed", status: 409 };
    }
    if (!suggestion.imageUrl?.trim()) {
      return { ok: false as const, error: "Suggestion needs an image before approval", status: 400 };
    }

    await tx.insert(shopItem).values({
      id: createdItemId,
      name: suggestion.name,
      description: suggestion.description ?? null,
      imageUrl: suggestion.imageUrl,
      orderNoteRequired: suggestion.orderNoteRequired,
      approvedHoursNeeded: suggestion.approvedHoursNeeded,
      tokenCost: suggestion.tokenCost,
      createdAt: now,
      updatedAt: now,
    });

    await tx
      .update(shopItemSuggestion)
      .set({
        status: "approved",
        reviewedById: input.adminUserId,
        reviewedAt: now,
        approvedShopItemId: createdItemId,
        rejectionReason: null,
        updatedAt: now,
      })
      .where(eq(shopItemSuggestion.id, input.suggestionId));

    return { ok: true as const, shopItemId: createdItemId };
  });
}

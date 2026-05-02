import { eq } from "drizzle-orm";
import { db } from "@/db";
import { shopItem, shopItemSuggestion, type ShopItemSuggestionStatus } from "@/db/schema";
import { generateId } from "@/lib/api-utils";

export const SHOP_ORDER_MIN_QUANTITY = 1;
export const SHOP_ORDER_MAX_QUANTITY = 99;

export function parseShopOrderQuantity(value: unknown): number | null {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value.trim())
        : SHOP_ORDER_MIN_QUANTITY;
  if (!Number.isFinite(raw) || !Number.isInteger(raw)) return null;
  if (raw < SHOP_ORDER_MIN_QUANTITY || raw > SHOP_ORDER_MAX_QUANTITY) return null;
  return raw;
}

export function calculateShopOrderTotal(unitTokenCost: number, quantity: number) {
  const safeUnit =
    typeof unitTokenCost === "number" && Number.isFinite(unitTokenCost)
      ? Math.max(0, Math.floor(unitTokenCost))
      : 0;
  const safeQuantity =
    typeof quantity === "number" && Number.isFinite(quantity)
      ? Math.max(SHOP_ORDER_MIN_QUANTITY, Math.floor(quantity))
      : SHOP_ORDER_MIN_QUANTITY;
  return safeUnit * safeQuantity;
}

export function normalizeOptionalUrl(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isShopItemSuggestionStatus(value: unknown): value is ShopItemSuggestionStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

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

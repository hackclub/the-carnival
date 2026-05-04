import type { ShopItemSuggestionStatus } from "@/db/schema";

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

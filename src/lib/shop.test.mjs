import { describe, expect, test } from "bun:test";

const {
  SHOP_ORDER_MAX_QUANTITY,
  calculateShopOrderTotal,
  isShopItemSuggestionStatus,
  normalizeOptionalUrl,
  parseShopOrderQuantity,
} = await import("./shop-shared.ts");

describe("shop order quantity", () => {
  test("defaults missing quantities to one", () => {
    expect(parseShopOrderQuantity(undefined)).toBe(1);
    expect(parseShopOrderQuantity("")).toBe(1);
  });

  test("accepts positive integer quantities", () => {
    expect(parseShopOrderQuantity(3)).toBe(3);
    expect(parseShopOrderQuantity("4")).toBe(4);
  });

  test("rejects invalid quantities", () => {
    expect(parseShopOrderQuantity(0)).toBe(null);
    expect(parseShopOrderQuantity(1.5)).toBe(null);
    expect(parseShopOrderQuantity(SHOP_ORDER_MAX_QUANTITY + 1)).toBe(null);
    expect(parseShopOrderQuantity("nope")).toBe(null);
  });

  test("calculates total token cost from unit cost and quantity", () => {
    expect(calculateShopOrderTotal(25, 4)).toBe(100);
    expect(calculateShopOrderTotal(25.9, 2.2)).toBe(50);
  });
});

describe("shop item suggestions", () => {
  test("validates suggestion statuses", () => {
    expect(isShopItemSuggestionStatus("pending")).toBe(true);
    expect(isShopItemSuggestionStatus("approved")).toBe(true);
    expect(isShopItemSuggestionStatus("rejected")).toBe(true);
    expect(isShopItemSuggestionStatus("draft")).toBe(false);
  });

  test("normalizes optional http urls", () => {
    expect(normalizeOptionalUrl(" https://example.com/item ")).toBe("https://example.com/item");
    expect(normalizeOptionalUrl("http://example.com/item")).toBe("http://example.com/item");
    expect(normalizeOptionalUrl("ftp://example.com/item")).toBe(null);
    expect(normalizeOptionalUrl("")).toBe(null);
  });
});

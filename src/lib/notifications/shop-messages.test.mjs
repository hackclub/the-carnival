import { describe, expect, test } from "bun:test";

const { buildOrderDeniedMessage } = await import("./shop-messages.ts");

describe("buildOrderDeniedMessage", () => {
  test("mentions the user, quotes every line of the reason, and links the shop", () => {
    const text = buildOrderDeniedMessage({
      slackId: "U1",
      itemName: "Box <XL>",
      reason: "Address missing.\nAdd it on /account",
      shopUrl: "https://c.test/shop",
    });
    expect(text.startsWith("Hey <@U1>,")).toBe(true);
    expect(text).toContain("*Box &lt;XL&gt;* was denied. No tokens were deducted.");
    expect(text).toContain("> Address missing.\n> Add it on /account");
    expect(text).toContain("<https://c.test/shop|Carnival shop>");
  });

  test("works without a Slack ID", () => {
    const text = buildOrderDeniedMessage({ slackId: null, itemName: "X", reason: "No", shopUrl: "https://c.test/shop" });
    expect(text.startsWith("Hey,")).toBe(true);
  });
});

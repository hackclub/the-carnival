/**
 * Pure Slack copy for shop-order events (shop-messages.test.mjs).
 */
import { escapeSlackText, slackLink } from "./review-messages";

export function buildOrderDeniedMessage(input: {
  slackId: string | null;
  itemName: string;
  reason: string;
  shopUrl: string;
}): string {
  const hey = input.slackId?.trim() ? `Hey <@${input.slackId.trim()}>,` : "Hey,";
  const quoted = escapeSlackText(input.reason.trim())
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  return [
    hey,
    `🛍️ Your order for *${escapeSlackText(input.itemName)}* was denied. No tokens were deducted.`,
    "*Reason from the admin:*",
    quoted,
    `You can place a new order once that's sorted: ${slackLink(input.shopUrl, "Carnival shop")}`,
  ].join("\n");
}

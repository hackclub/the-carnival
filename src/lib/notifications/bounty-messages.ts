/**
 * Pure message builder for the "new bounty" post in the Carnival channel. No
 * DB or Slack imports so the copy can be unit tested (bounty-messages.test.mjs).
 */
import {
  formatBountyHours,
  getBountyEquivalentHours,
  getBountyMinimumHours,
} from "@/lib/bounties-shared";
import { escapeSlackText, slackLink, truncateForSlack } from "./review-messages";

export type NewBountyMessageInput = {
  name: string;
  description: string;
  requirements: string;
  prizeUsd: number;
  bountyUrl: string;
  helpfulLinks: Array<{ label: string; url: string }>;
};

const DESCRIPTION_MAX = 500;
const REQUIREMENTS_MAX = 500;
const HELPFUL_LINKS_MAX = 5;

/**
 * Bounty descriptions use the app's small rich-text syntax (RichTextContent):
 * `**bold**`, `*italic*`, `[label](url)` and `-`/`1.` lists. Convert that to
 * Slack mrkdwn, escaping everything the author typed.
 */
const INLINE_TOKEN =
  /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/\S+)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;

// One pass, so a URL is consumed whole and its "*" are never read as emphasis.
// Emphasis contents go through the same pass so a link inside bold still converts.
function convertInlineToken(
  match: string,
  label?: string,
  url?: string,
  bareUrl?: string,
  bold?: string,
  italic?: string,
): string {
  if (label !== undefined && url !== undefined) {
    return `<${url.replace(/\|/g, "%7C")}|${label}>`;
  }
  if (bareUrl !== undefined) return match;
  if (bold !== undefined) return `*${bold.replace(INLINE_TOKEN, convertInlineToken)}*`;
  return `_${(italic ?? "").replace(INLINE_TOKEN, convertInlineToken)}_`;
}

export function richTextToSlack(value: string, max: number): string {
  const escaped = escapeSlackText(truncateForSlack(value.replace(/\r\n/g, "\n"), max));
  return escaped
    .split("\n")
    .map((line) =>
      line
        .trimEnd()
        .replace(/^\s*[-*]\s+/, "• ")
        .replace(INLINE_TOKEN, convertInlineToken),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

/** A URL can't contain the characters that end or split a Slack link. */
function safeSlackUrl(url: string): string {
  return url.replace(/[<>|]/g, (char) => encodeURIComponent(char));
}

export function buildNewBountyMessage(input: NewBountyMessageInput): string {
  const lines = [
    `🎯 *New bounty:* ${slackLink(input.bountyUrl, input.name)}`,
    `*Prize:* $${input.prizeUsd.toLocaleString("en-US")} (worth ${formatBountyHours(
      getBountyEquivalentHours(input.prizeUsd),
    )}) · *Minimum time:* ${formatBountyHours(getBountyMinimumHours(input.prizeUsd))}`,
  ];

  const description = richTextToSlack(input.description, DESCRIPTION_MAX);
  if (description) lines.push("", description);

  const requirements = richTextToSlack(input.requirements, REQUIREMENTS_MAX);
  if (requirements) lines.push("", "*Requirements*", requirements);

  const links = input.helpfulLinks.slice(0, HELPFUL_LINKS_MAX);
  if (links.length > 0) {
    lines.push(
      "",
      `*Helpful links:* ${links.map((l) => slackLink(safeSlackUrl(l.url), l.label)).join(" · ")}`,
    );
  }

  lines.push(
    "",
    `Up to 2 people can claim it. ${slackLink(input.bountyUrl, "See the bounty and claim it →")}`,
  );
  return lines.join("\n");
}

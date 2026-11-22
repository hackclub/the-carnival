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

// Links and bare URLs. Converted first and parked behind placeholders, so the
// emphasis pass never sees a URL (whose "*" would read as emphasis) and both
// patterns stay simple enough to run in linear time on any input.
const LINK_OR_URL = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|https?:\/\/\S+/g;
const EMPHASIS = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
// Private-use characters: they mark a parked link and are stripped from input.
const PARK_OPEN = "\uE000";
const PARK_CLOSE = "\uE001";
const PARK_CHARS = /[\uE000\uE001]/g;
const PARKED = /\uE000(\d+)\uE001/g;

function convertInline(line: string): string {
  const parked: string[] = [];
  return line
    .replace(PARK_CHARS, "")
    .replace(LINK_OR_URL, (match, label?: string, url?: string) => {
      parked.push(
        label !== undefined && url !== undefined
          ? `<${url.replace(/\|/g, "%7C")}|${label}>`
          : match,
      );
      return `${PARK_OPEN}${parked.length - 1}${PARK_CLOSE}`;
    })
    .replace(EMPHASIS, (_match, bold?: string, italic?: string) =>
      bold !== undefined ? `*${bold}*` : `_${italic ?? ""}_`,
    )
    .replace(PARKED, (_match, index: string) => parked[Number(index)] ?? "");
}

/**
 * Bounty descriptions use the app's small rich-text syntax (RichTextContent):
 * `**bold**`, `*italic*`, `[label](url)` and `-`/`1.` lists. Convert that to
 * Slack mrkdwn, escaping everything the author typed.
 */
export function richTextToSlack(value: string, max: number): string {
  const escaped = escapeSlackText(truncateForSlack(value.replace(/\r\n/g, "\n"), max));
  return escaped
    .split("\n")
    .map((line) => convertInline(line.trimEnd().replace(/^\s*[-*]\s+/, "• ")))
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

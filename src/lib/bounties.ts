import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bountyProject, type BountyHelpfulLink } from "@/db/schema";
import { toCleanString } from "@/lib/api-utils";
import { usdToTokens } from "@/lib/wallet-converter";

export function bountyPrizeUsdToTokens(prizeUsd: number) {
  const usd = Number.isFinite(prizeUsd) ? Math.max(0, prizeUsd) : 0;
  return Math.max(0, Math.floor(usdToTokens(usd)));
}

export function toBountyHelpfulLinks(value: unknown): BountyHelpfulLink[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;

  const links: BountyHelpfulLink[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const label = toCleanString((item as { label?: unknown }).label);
    const url = toCleanString((item as { url?: unknown }).url);

    if (!label && !url) continue;
    if (!label || !url) return null;

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null;
      }
    } catch {
      return null;
    }

    links.push({ label, url });
  }

  return links;
}

export function isValidHttpUrl(value: string) {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function validateLinkableBountyProjectId(
  bountyProjectId: string | null,
  existingBountyProjectId?: string | null,
) {
  if (!bountyProjectId) return { ok: true as const };
  if (existingBountyProjectId && bountyProjectId === existingBountyProjectId) {
    return { ok: true as const };
  }

  const rows = await db
    .select({
      id: bountyProject.id,
      status: bountyProject.status,
      completed: bountyProject.completed,
    })
    .from(bountyProject)
    .where(eq(bountyProject.id, bountyProjectId))
    .limit(1);

  const bounty = rows[0];
  if (!bounty) {
    return { ok: false as const, error: "Selected bounty was not found." };
  }
  if (bounty.status !== "approved") {
    return { ok: false as const, error: "Selected bounty is not official yet." };
  }
  if (bounty.completed) {
    return { ok: false as const, error: "Selected bounty has already been completed." };
  }

  return { ok: true as const };
}

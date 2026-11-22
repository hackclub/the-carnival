/**
 * Bounty Slack notifications (DB-aware half). The copy lives in
 * bounty-messages.ts.
 *
 * Best-effort like every other notification: missing config or Slack errors
 * log and return; they never fail the request that triggered them.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bountyProject } from "@/db/schema";
import { getAppBaseUrl } from "@/lib/loops";
import { buildNewBountyMessage } from "./bounty-messages";
import { getBountyChannelId, isSlackConfigured, postSlackMessage } from "./slack-client";

/**
 * Announce a bounty that just became official (created by an admin, or a
 * proposal an admin approved) in the Carnival channel.
 */
export async function announceNewBounty(bountyId: string): Promise<void> {
  const channel = getBountyChannelId();
  if (!isSlackConfigured() || !channel) return;

  try {
    const rows = await db
      .select({
        id: bountyProject.id,
        name: bountyProject.name,
        description: bountyProject.description,
        requirements: bountyProject.requirements,
        prizeUsd: bountyProject.prizeUsd,
        helpfulLinks: bountyProject.helpfulLinks,
        status: bountyProject.status,
        completed: bountyProject.completed,
      })
      .from(bountyProject)
      .where(eq(bountyProject.id, bountyId))
      .limit(1);
    const bounty = rows[0];
    // Re-check: it may have been rejected, completed or deleted since the request.
    if (bounty?.status !== "approved" || bounty.completed) return;

    const text = buildNewBountyMessage({
      name: bounty.name,
      description: bounty.description,
      requirements: bounty.requirements,
      prizeUsd: bounty.prizeUsd,
      bountyUrl: `${getAppBaseUrl()}/bounties/${encodeURIComponent(bounty.id)}`,
      helpfulLinks: Array.isArray(bounty.helpfulLinks) ? bounty.helpfulLinks : [],
    });

    const result = await postSlackMessage({ channel, text });
    if (!result.ok) console.error("[Slack] Failed to announce bounty", result.error);
  } catch (err) {
    console.error("[Slack] announceNewBounty failed", err);
  }
}

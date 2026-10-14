import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { shopOrder, user } from "@/db/schema";
import { getAuthUser, parseJsonBody, toCleanString } from "@/lib/api-utils";
import { getAppBaseUrl, sendShopOrderDeniedParticipantEmail } from "@/lib/loops";
import { runAfterResponse } from "@/lib/notifications/after-response";
import { buildOrderDeniedMessage } from "@/lib/notifications/shop-messages";
import { postSlackMessage } from "@/lib/notifications/slack-client";

type DenyBody = {
  reason?: unknown;
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getAuthUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!admin.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = await parseJsonBody<DenyBody>(req);
  const reason = toCleanString(body?.reason);
  if (!reason) return NextResponse.json({ error: "reason is required" }, { status: 400 });

  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: shopOrder.id,
        status: shopOrder.status,
        itemName: shopOrder.itemNameSnapshot,
        participantName: user.name,
        participantEmail: user.email,
        participantSlackId: user.slackId,
      })
      .from(shopOrder)
      .leftJoin(user, eq(user.id, shopOrder.userId))
      .where(eq(shopOrder.id, id))
      .limit(1);

    const order = rows[0];
    if (!order) return { error: "Not found" as const, status: 404 as const };
    if (order.status === "fulfilled") {
      return { error: "Cannot deny an order that is already fulfilled" as const, status: 409 as const };
    }
    if (order.status === "cancelled") return { ok: true as const };

    const updated = await tx
      .update(shopOrder)
      .set({
        status: "cancelled",
        cancellationReason: reason,
        cancelledById: admin.id,
        cancelledAt: now,
        updatedAt: now,
      })
      .where(and(eq(shopOrder.id, id), eq(shopOrder.status, "pending")))
      .returning({ id: shopOrder.id });

    if (!updated[0]) {
      return { error: "Failed to deny order" as const, status: 409 as const };
    }
    return { ok: true as const, notify: order };
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  // Tell the participant why, so they don't repeat the mistake. Only on the
  // pending -> cancelled transition (re-denying is a no-op above).
  if ("notify" in result && result.notify) {
    const order = result.notify;
    const shopUrl = `${getAppBaseUrl()}/shop`;
    runAfterResponse(async () => {
      const sends: Promise<unknown>[] = [];
      if (order.participantSlackId?.trim()) {
        sends.push(
          postSlackMessage({
            channel: order.participantSlackId,
            text: buildOrderDeniedMessage({
              slackId: order.participantSlackId,
              itemName: order.itemName,
              reason,
              shopUrl,
            }),
          }),
        );
      }
      if (order.participantEmail?.trim()) {
        sends.push(
          sendShopOrderDeniedParticipantEmail(order.participantEmail, {
            participant_name: order.participantName ?? "there",
            order_id: order.id,
            item_name: order.itemName,
            denial_reason: reason,
            denied_at: now.toISOString(),
            shop_url: shopUrl,
          }),
        );
      }
      await Promise.all(sends);
    }, "shop order denied notification");
  }

  return NextResponse.json({ ok: true });
}


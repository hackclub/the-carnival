import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { shopOrder } from "@/db/schema";
import { getAuthUser, parseJsonBody, toCleanString } from "@/lib/api-utils";

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
      })
      .from(shopOrder)
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
    return { ok: true as const };
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}


import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { shopItem } from "@/db/schema";
import { getAuthUser, parseJsonBody, toCleanString, toPositiveInt } from "@/lib/api-utils";

type PatchItemBody = {
  name?: unknown;
  imageUrl?: unknown;
  approvedHoursNeeded?: unknown;
  tokenCost?: unknown;
};

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const rows = await db
    .select({
      id: shopItem.id,
      name: shopItem.name,
      imageUrl: shopItem.imageUrl,
      approvedHoursNeeded: shopItem.approvedHoursNeeded,
      tokenCost: shopItem.tokenCost,
      createdAt: shopItem.createdAt,
      updatedAt: shopItem.updatedAt,
    })
    .from(shopItem)
    .where(eq(shopItem.id, id))
    .limit(1);

  const item = rows[0];
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    item: {
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = await parseJsonBody<PatchItemBody>(req);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const set: Partial<{
    name: string;
    imageUrl: string;
    approvedHoursNeeded: number;
    tokenCost: number;
    updatedAt: Date;
  }> = { updatedAt: new Date() };

  if (body.name !== undefined) {
    const name = toCleanString(body.name);
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    set.name = name;
  }

  if (body.imageUrl !== undefined) {
    const imageUrl = toCleanString(body.imageUrl);
    if (!imageUrl) return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
    set.imageUrl = imageUrl;
  }

  if (body.approvedHoursNeeded !== undefined) {
    const v = toPositiveInt(body.approvedHoursNeeded);
    if (!Number.isFinite(v) || v < 0) {
      return NextResponse.json({ error: "approvedHoursNeeded must be a non-negative integer" }, { status: 400 });
    }
    set.approvedHoursNeeded = v;
  }

  if (body.tokenCost !== undefined) {
    const v = toPositiveInt(body.tokenCost);
    if (!Number.isFinite(v) || v < 0) {
      return NextResponse.json({ error: "tokenCost must be a non-negative integer" }, { status: 400 });
    }
    set.tokenCost = v;
  }

  const updated = await db
    .update(shopItem)
    .set(set)
    .where(eq(shopItem.id, id))
    .returning({
      id: shopItem.id,
      name: shopItem.name,
      imageUrl: shopItem.imageUrl,
      approvedHoursNeeded: shopItem.approvedHoursNeeded,
      tokenCost: shopItem.tokenCost,
      updatedAt: shopItem.updatedAt,
    });

  const item = updated[0];
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    item: {
      ...item,
      updatedAt: item.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const deleted = await db.delete(shopItem).where(eq(shopItem.id, id)).returning({ id: shopItem.id });
  if (deleted.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}


import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { shopItem } from "@/db/schema";
import { getAuthUser, parseJsonBody, toCleanString, toPositiveInt, generateId } from "@/lib/api-utils";

type CreateItemBody = {
  name?: unknown;
  description?: unknown;
  imageUrl?: unknown;
  approvedHoursNeeded?: unknown;
  tokenCost?: unknown;
};

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isReviewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const items = await db
    .select({
      id: shopItem.id,
      name: shopItem.name,
      description: shopItem.description,
      imageUrl: shopItem.imageUrl,
      approvedHoursNeeded: shopItem.approvedHoursNeeded,
      tokenCost: shopItem.tokenCost,
      createdAt: shopItem.createdAt,
      updatedAt: shopItem.updatedAt,
    })
    .from(shopItem)
    .orderBy(asc(shopItem.name));

  return NextResponse.json({
    items: items.map((i) => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isReviewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await parseJsonBody<CreateItemBody>(req);
  const name = toCleanString(body?.name);
  const description = toCleanString(body?.description) || null;
  const imageUrl = toCleanString(body?.imageUrl);
  const approvedHoursNeeded = toPositiveInt(body?.approvedHoursNeeded);
  const tokenCost = toPositiveInt(body?.tokenCost);

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!imageUrl) return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
  if (!Number.isFinite(approvedHoursNeeded) || approvedHoursNeeded < 0) {
    return NextResponse.json({ error: "approvedHoursNeeded must be a non-negative integer" }, { status: 400 });
  }
  if (!Number.isFinite(tokenCost) || tokenCost < 0) {
    return NextResponse.json({ error: "tokenCost must be a non-negative integer" }, { status: 400 });
  }

  const now = new Date();
  const id = generateId();

  await db.insert(shopItem).values({
    id,
    name,
    description,
    imageUrl,
    approvedHoursNeeded,
    tokenCost,
    createdAt: now,
    updatedAt: now,
  });

  const created = await db
    .select({
      id: shopItem.id,
      name: shopItem.name,
      description: shopItem.description,
      imageUrl: shopItem.imageUrl,
      approvedHoursNeeded: shopItem.approvedHoursNeeded,
      tokenCost: shopItem.tokenCost,
    })
    .from(shopItem)
    .where(eq(shopItem.id, id))
    .limit(1);

  return NextResponse.json({ item: created[0] }, { status: 201 });
}


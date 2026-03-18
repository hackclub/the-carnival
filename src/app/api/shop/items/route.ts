import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { shopItem } from "@/db/schema";
import { getAuthUser } from "@/lib/api-utils";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await db
    .select({
      id: shopItem.id,
      name: shopItem.name,
      description: shopItem.description,
      imageUrl: shopItem.imageUrl,
      orderNoteRequired: shopItem.orderNoteRequired,
      approvedHoursNeeded: shopItem.approvedHoursNeeded,
      tokenCost: shopItem.tokenCost,
    })
    .from(shopItem)
    .orderBy(asc(shopItem.name));

  return NextResponse.json({ items });
}

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
      imageUrl: shopItem.imageUrl,
      approvedHoursNeeded: shopItem.approvedHoursNeeded,
      tokenCost: shopItem.tokenCost,
    })
    .from(shopItem)
    .orderBy(asc(shopItem.name));

  return NextResponse.json({ items });
}


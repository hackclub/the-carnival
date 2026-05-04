import { NextResponse } from "next/server";
import { db } from "@/db";
import { getAuthUser } from "@/lib/api-utils";
import { getTokenBalance } from "@/lib/wallet";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const balance = await getTokenBalance(db, user.id);
  return NextResponse.json({ balance, fetchedAt: new Date().toISOString() });
}

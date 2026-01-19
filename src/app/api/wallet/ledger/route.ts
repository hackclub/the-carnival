import { NextResponse } from "next/server";
import { db } from "@/db";
import { getAuthUser } from "@/lib/api-utils";
import { getLedgerForUser, getTokenBalance } from "@/lib/wallet";

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 50;

  const [balance, ledger] = await Promise.all([
    getTokenBalance(db, user.id),
    getLedgerForUser(db, user.id, Number.isFinite(limit) ? limit : 50),
  ]);

  return NextResponse.json({
    balance,
    ledger: ledger.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}


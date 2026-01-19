import { and, desc, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { PostgresJsTransaction } from "drizzle-orm/postgres-js";
import type { TablesRelationalConfig } from "drizzle-orm/relations";
import type * as schema from "@/db/schema";
import { tokenLedger } from "@/db/schema";

export type WalletLedgerRow = {
  id: string;
  kind: "issue" | "deduct";
  tokens: number;
  reason: string;
  byUserId: string | null;
  createdAt: Date;
};

type DbLike =
  | PostgresJsDatabase<typeof schema>
  | PostgresJsTransaction<typeof schema, TablesRelationalConfig>;

export async function getTokenBalance(
  db: DbLike,
  userId: string,
): Promise<number> {
  const rows = await db
    .select({
      balance: sql<number>`coalesce(sum(case when ${tokenLedger.kind} = 'issue' then ${tokenLedger.tokens} else -${tokenLedger.tokens} end), 0)`,
    })
    .from(tokenLedger)
    .where(eq(tokenLedger.issuedToUserId, userId))
    .limit(1);

  const balance = +(rows[0]?.balance ?? 0);
  return Number.isFinite(balance) ? balance : 0;
}

export async function getLedgerForUser(
  db: DbLike,
  userId: string,
  limit = 50,
): Promise<WalletLedgerRow[]> {
  const rows = await db
    .select({
      id: tokenLedger.id,
      kind: tokenLedger.kind,
      tokens: tokenLedger.tokens,
      reason: tokenLedger.reason,
      byUserId: tokenLedger.byUserId,
      createdAt: tokenLedger.createdAt,
    })
    .from(tokenLedger)
    .where(eq(tokenLedger.issuedToUserId, userId))
    .orderBy(desc(tokenLedger.createdAt))
    .limit(Math.max(1, Math.min(200, limit)));

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    tokens: r.tokens ?? 0,
    reason: r.reason,
    byUserId: r.byUserId ?? null,
    createdAt: r.createdAt,
  }));
}

export async function hasIssuedTokensForProjectGrant(
  db: DbLike,
  projectId: string,
) {
  const rows = await db
    .select({ id: tokenLedger.id })
    .from(tokenLedger)
    .where(
      and(
        eq(tokenLedger.referenceType, "project_grant"),
        eq(tokenLedger.referenceId, projectId),
        eq(tokenLedger.kind, "issue"),
      ),
    )
    .limit(1);
  return !!rows[0];
}


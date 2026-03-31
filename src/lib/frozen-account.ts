import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";

export type FrozenAccountState = {
  isFrozen: boolean;
  frozenReason: string | null;
  frozenAt: Date | null;
};

type FreezeDb = Pick<typeof db, "select">;

export async function getFrozenAccountState(
  userId: string,
  freezeDb: FreezeDb = db,
): Promise<FrozenAccountState> {
  const rows = await freezeDb
    .select({
      isFrozen: user.isFrozen,
      frozenReason: user.frozenReason,
      frozenAt: user.frozenAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return { isFrozen: false, frozenReason: null, frozenAt: null };
  }

  return {
    isFrozen: !!row.isFrozen,
    frozenReason: row.frozenReason ?? null,
    frozenAt: row.frozenAt ?? null,
  };
}

export function getFrozenAccountMessage(reason: string | null): string {
  const cleanReason = typeof reason === "string" ? reason.trim() : "";
  if (cleanReason) return `Account is frozen: ${cleanReason}`;
  return "Account is frozen. Contact an admin for support.";
}

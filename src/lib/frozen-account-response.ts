import { NextResponse } from "next/server";
import { getFrozenAccountMessage, getFrozenAccountState } from "@/lib/frozen-account";

/** The 403 a frozen account gets from any write endpoint, or null when the account is active. */
export async function frozenAccountResponse(userId: string) {
  const state = await getFrozenAccountState(userId);
  if (!state.isFrozen) return null;
  return NextResponse.json(
    { error: getFrozenAccountMessage(state.frozenReason), code: "account_frozen" },
    { status: 403 },
  );
}

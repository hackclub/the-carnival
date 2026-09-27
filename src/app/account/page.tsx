import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import AccountProfileClient from "@/components/AccountProfileClient";
import { db } from "@/db";
import { user } from "@/db/schema";
import { verifyHackatimeAccessTokenForUser } from "@/lib/hackatime";
import { getServerSession } from "@/lib/server-session";

export default async function AccountPage() {
  const session = await getServerSession({ disableCookieCache: true });
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account");
  }

  // This page claims "Connected", so check with Hackatime first: a token
  // revoked on their side is dropped here and the card offers Reconnect,
  // even if no project page has tried to use the token yet.
  const [rows, hackatimeVerification] = await Promise.all([
    db
      .select({
        birthday: user.birthday,
        addressLine1: user.addressLine1,
        addressLine2: user.addressLine2,
        city: user.city,
        stateProvince: user.stateProvince,
        country: user.country,
        zipPostalCode: user.zipPostalCode,
        hackatimeUserId: user.hackatimeUserId,
        hackatimeConnectedAt: user.hackatimeConnectedAt,
      })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1),
    verifyHackatimeAccessTokenForUser(session.user.id),
  ]);

  const row = rows[0];

  return (
    <AppShell title="Account settings">
      <AccountProfileClient
        initial={{
          birthday: row?.birthday ?? null,
          addressLine1: row?.addressLine1 ?? null,
          addressLine2: row?.addressLine2 ?? null,
          city: row?.city ?? null,
          stateProvince: row?.stateProvince ?? null,
          country: row?.country ?? null,
          zipPostalCode: row?.zipPostalCode ?? null,
          hackatimeUserId: row?.hackatimeUserId ?? null,
          hackatimeConnectedAt: row?.hackatimeConnectedAt
            ? row.hackatimeConnectedAt.toISOString()
            : null,
          // Only a boolean crosses to the client; the token itself never does.
          // "unknown" (Hackatime unreachable) keeps the stored state.
          hackatimeConnected:
            hackatimeVerification === "ok" || hackatimeVerification === "unknown",
        }}
      />
    </AppShell>
  );
}

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import AccountProfileClient from "@/components/AccountProfileClient";
import { db } from "@/db";
import { user } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

export default async function AccountPage() {
  const session = await getServerSession({ disableCookieCache: true });
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account");
  }

  const rows = await db
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
      hackatimeAccessToken: user.hackatimeAccessToken,
    })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

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
          // Only the boolean crosses to the client; the token itself never does.
          // A connected-at timestamp without a token means Hackatime revoked
          // Carnival's access and the user needs to reconnect.
          hackatimeConnected: !!row?.hackatimeAccessToken?.trim(),
        }}
      />
    </AppShell>
  );
}

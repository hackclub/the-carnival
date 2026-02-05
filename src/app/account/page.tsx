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
    })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  const initial = rows[0] ?? {
    birthday: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    stateProvince: null,
    country: null,
    zipPostalCode: null,
  };

  return (
    <AppShell title="Account settings">
      <AccountProfileClient initial={initial} />
    </AppShell>
  );
}


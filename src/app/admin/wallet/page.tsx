import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import AdminWalletClient, { type WalletUserOption } from "@/components/AdminWalletClient";
import { db } from "@/db";
import { user } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function AdminWalletPage() {
  const session = await getServerSession({ disableCookieCache: true });
  const role = (session?.user as { role?: unknown } | undefined)?.role;

  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/wallet");
  if (role !== "admin") redirect("/projects");

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    })
    .from(user)
    .orderBy(asc(user.name));

  const users: WalletUserOption[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
  }));

  return (
    <AppShell title="Wallets">
      <AdminWalletClient users={users} />
    </AppShell>
  );
}

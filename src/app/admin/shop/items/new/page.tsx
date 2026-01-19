import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import AdminShopItemFormClient from "@/components/AdminShopItemFormClient";
import { getServerSession } from "@/lib/server-session";

export default async function NewShopItemPage() {
  const session = await getServerSession({ disableCookieCache: true });
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/shop/items/new");
  if (role !== "admin") redirect("/projects");

  return (
    <AppShell title="New shop item">
      <AdminShopItemFormClient mode="create" />
    </AppShell>
  );
}


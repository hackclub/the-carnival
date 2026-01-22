import { notFound, redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import AdminShopItemFormClient from "@/components/AdminShopItemFormClient";
import { db } from "@/db";
import { shopItem } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getServerSession } from "@/lib/server-session";

export default async function EditShopItemPage(props: { params: Promise<{ id: string }> }) {
  const session = await getServerSession({ disableCookieCache: true });
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/shop");
  if (role !== "admin") redirect("/projects");

  const { id } = await props.params;
  const rows = await db
    .select({
      id: shopItem.id,
      name: shopItem.name,
      description: shopItem.description,
      imageUrl: shopItem.imageUrl,
      approvedHoursNeeded: shopItem.approvedHoursNeeded,
      tokenCost: shopItem.tokenCost,
    })
    .from(shopItem)
    .where(eq(shopItem.id, id))
    .limit(1);

  const item = rows[0];
  if (!item) notFound();

  return (
    <AppShell title="Edit shop item">
      <AdminShopItemFormClient
        mode="edit"
        initial={{
          id: item.id,
          name: item.name,
          description: item.description ?? null,
          imageUrl: item.imageUrl,
          approvedHoursNeeded: item.approvedHoursNeeded ?? 0,
          tokenCost: item.tokenCost ?? 0,
        }}
      />
    </AppShell>
  );
}


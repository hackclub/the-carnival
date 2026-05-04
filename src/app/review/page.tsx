import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import ReviewFiltersClient from "@/components/ReviewFiltersClient";
import ReviewQueueClient from "@/components/ReviewQueueClient";
import { type ProjectStatus, type UserRole } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function canReview(role: unknown): role is Extract<UserRole, "reviewer" | "admin"> {
  return role === "reviewer" || role === "admin";
}

type FilterKey = "pending" | "approved" | "rejected";

const FILTERS: Array<{ label: string; value: FilterKey; statuses: ProjectStatus[] }> = [
  { label: "Pending", value: "pending", statuses: ["in-review"] },
  { label: "Approved", value: "approved", statuses: ["shipped", "granted"] },
  { label: "Rejected", value: "rejected", statuses: ["work-in-progress"] },
];

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string | string[] }>;
}) {
  const session = await getServerSession({ disableCookieCache: true });
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/review");
  }

  const role = (session.user as { role?: unknown } | undefined)?.role;
  if (!canReview(role)) {
    redirect("/projects");
  }

  const sp = await searchParams;
  const rawStatus = sp?.status;
  const statusParam = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
  const allowed = new Set(FILTERS.map((f) => f.value));
  const activeFilter: FilterKey = allowed.has(statusParam as FilterKey)
    ? (statusParam as FilterKey)
    : "pending";
  void activeFilter;

  return (
    <AppShell title="Review queue">
      <ReviewFiltersClient
        filters={FILTERS.map((f) => ({ label: f.label, value: f.value }))}
        defaultValue="pending"
      />

      <ReviewQueueClient />
    </AppShell>
  );
}


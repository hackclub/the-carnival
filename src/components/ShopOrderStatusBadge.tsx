import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { ShopOrderStatus } from "@/db/schema";

const ORDER_STATUS_META: Record<ShopOrderStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: "Pending", variant: "warning" },
  fulfilled: { label: "Fulfilled", variant: "success" },
  cancelled: { label: "Denied", variant: "error" },
};

export default function ShopOrderStatusBadge({ status }: { status: ShopOrderStatus }) {
  const meta = ORDER_STATUS_META[status] ?? ORDER_STATUS_META.pending;
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

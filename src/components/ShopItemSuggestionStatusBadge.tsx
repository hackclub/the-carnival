import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { ShopItemSuggestionStatus } from "@/db/schema";

const SUGGESTION_STATUS_META: Record<ShopItemSuggestionStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: "Pending", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "error" },
};

export default function ShopItemSuggestionStatusBadge({
  status,
}: {
  status: ShopItemSuggestionStatus;
}) {
  const meta = SUGGESTION_STATUS_META[status] ?? SUGGESTION_STATUS_META.pending;
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

import type { ProjectStatus } from "@/db/schema";
import { Badge, type BadgeVariant } from "@/components/ui/badge";

const LABELS: Record<ProjectStatus, string> = {
  shipped: "Shipped",
  granted: "Granted",
  "in-review": "In review",
  "work-in-progress": "Work in progress",
};

const STATUS_VARIANT: Record<ProjectStatus, BadgeVariant> = {
  shipped: "success",
  granted: "purple",
  "in-review": "info",
  "work-in-progress": "warning",
};

export default function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {LABELS[status]}
    </Badge>
  );
}



import type { ProjectStatus } from "@/db/schema";

const LABELS: Record<ProjectStatus, string> = {
  shipped: "Shipped",
  granted: "Granted",
  "in-review": "In review",
  "work-in-progress": "Work in progress",
};

const STYLES: Record<ProjectStatus, string> = {
  shipped: "bg-carnival-orange/20 text-carnival-orange border-carnival-orange/30",
  granted: "bg-carnival-yellow/20 text-carnival-yellow border-carnival-yellow/30",
  "in-review": "bg-carnival-purple/25 text-carnival-purple border-carnival-purple/30",
  "work-in-progress": "bg-white/10 text-gray-200 border-white/15",
};

export default function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        STYLES[status],
      ].join(" ")}
    >
      {LABELS[status]}
    </span>
  );
}



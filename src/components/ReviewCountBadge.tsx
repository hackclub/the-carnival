import { MessageCircle } from "lucide-react";

type ReviewCountBadgeProps = {
  count: number;
  className?: string;
};

export default function ReviewCountBadge({ count, className = "" }: ReviewCountBadgeProps) {
  if (count === 0) return null;

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        "bg-sky-500/15 text-sky-700 border-sky-500/30 shadow-sm shadow-sky-500/10",
        className,
      ].join(" ")}
      title={`${count} review comment${count === 1 ? "" : "s"}`}
    >
      <MessageCircle className="w-3 h-3" />
      {count}
    </span>
  );
}

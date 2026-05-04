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
        "inline-flex items-center gap-1.5 rounded-[var(--carnival-squircle-radius)] border-2 px-2.5 py-1 text-xs font-black uppercase tracking-[0.04em]",
        "border-[#2363b8] bg-[#dbeafe] text-[#174582]",
        className,
      ].join(" ")}
      title={`${count} review comment${count === 1 ? "" : "s"}`}
    >
      <MessageCircle className="w-3 h-3" />
      {count}
    </span>
  );
}

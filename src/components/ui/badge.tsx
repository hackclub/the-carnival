export const badgeVariants = {
  default: "border-border bg-muted text-foreground",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  error: "border-red-200 bg-red-50 text-red-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  purple: "border-violet-200 bg-violet-50 text-violet-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export type BadgeVariant = keyof typeof badgeVariants;

type BadgeProps = {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

export function Badge({
  children,
  variant = "default",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[0.68rem] font-semibold tracking-wide ${badgeVariants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

// ============================================================================
// Badge variants
// ============================================================================

export const badgeVariants = {
  default: "bg-muted text-muted-foreground border-border",
  success: "bg-emerald-500/14 text-emerald-800 border-emerald-500/28",
  warning: "bg-amber-500/16 text-amber-800 border-amber-500/32",
  error: "bg-rose-500/14 text-rose-800 border-rose-500/28",
  info: "bg-sky-500/14 text-sky-800 border-sky-500/28",
  purple: "bg-violet-500/14 text-violet-800 border-violet-500/28",
  emerald: "bg-teal-500/14 text-teal-800 border-teal-500/28",
};

// ============================================================================
// Badge component
// ============================================================================

type BadgeVariant = keyof typeof badgeVariants;

type BadgeProps = {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span
      className={`carnival-badge shrink-0 border px-2.5 py-1 text-xs ${badgeVariants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

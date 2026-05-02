// ============================================================================
// Badge variants
// ============================================================================

export const badgeVariants = {
  default: "bg-muted text-foreground ring-1 ring-border",
  success: "bg-green-500/15 text-green-700 ring-1 ring-green-600/30 dark:text-green-300",
  warning: "bg-amber-500/15 text-amber-700 ring-1 ring-amber-600/30 dark:text-amber-300",
  error: "bg-red-500/15 text-red-700 ring-1 ring-red-600/30 dark:text-red-300",
  info: "bg-blue-500/15 text-blue-700 ring-1 ring-blue-600/30 dark:text-blue-300",
  purple: "bg-purple-500/15 text-purple-700 ring-1 ring-purple-600/30 dark:text-purple-300",
  emerald: "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-600/30 dark:text-emerald-300",
};

// ============================================================================
// Badge component
// ============================================================================

export type BadgeVariant = keyof typeof badgeVariants;

type BadgeProps = {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span className={`shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${badgeVariants[variant]} ${className}`}>
      {children}
    </span>
  );
}


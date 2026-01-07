// ============================================================================
// Badge variants
// ============================================================================

export const badgeVariants = {
  default: "bg-muted text-muted-foreground",
  success: "bg-green-500/10 text-green-600 ring-1 ring-green-500/20",
  warning: "bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20",
  error: "bg-red-500/10 text-red-600 ring-1 ring-red-500/20",
  info: "bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20",
  purple: "bg-purple-500/10 text-purple-600 ring-1 ring-purple-500/20",
  emerald: "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20",
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
    <span className={`shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${badgeVariants[variant]} ${className}`}>
      {children}
    </span>
  );
}


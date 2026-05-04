// ============================================================================
// Badge variants
// ============================================================================

export const badgeVariants = {
  default: "border-[var(--carnival-border)] bg-[#fff0cf] text-[var(--platform-ink)]",
  success: "border-[#176b45] bg-[#dff8dc] text-[#176b45]",
  warning: "border-[#9a4e0a] bg-[#ffe8a8] text-[#7b240a]",
  error: "border-[#a51d2d] bg-[#ffe2d4] text-[#8d1a2b]",
  info: "border-[#2363b8] bg-[#dbeafe] text-[#174582]",
  purple: "border-[#6d28d9] bg-[#ede9fe] text-[#4c1d95]",
  emerald: "border-[#047857] bg-[#d1fae5] text-[#065f46]",
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
    <span className={`shrink-0 rounded-[var(--carnival-squircle-radius)] border-2 px-2.5 py-0.5 text-[0.68rem] font-black uppercase tracking-[0.06em] shadow-none ${badgeVariants[variant]} ${className}`}>
      {children}
    </span>
  );
}

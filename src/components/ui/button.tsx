import { forwardRef } from "react";

// ============================================================================
// Button variants
// ============================================================================

export const buttonVariants = {
  primary: [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap select-none touch-manipulation",
    "px-6 py-3 text-sm font-black uppercase tracking-[0.08em]",
    "carnival-button-base carnival-button-primary",
  ].join(" "),

  secondary: [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap select-none touch-manipulation",
    "px-5 py-2.5 text-sm font-black uppercase tracking-[0.08em]",
    "carnival-button-base carnival-button-secondary",
  ].join(" "),

  outline: [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap select-none touch-manipulation",
    "px-5 py-2.5 text-sm font-black uppercase tracking-[0.08em]",
    "carnival-button-base carnival-button-outline",
  ].join(" "),

  ghost: [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap select-none touch-manipulation",
    "px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.06em]",
    "carnival-button-base carnival-button-ghost",
  ].join(" "),

  disabled: [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap select-none touch-manipulation",
    "px-5 py-2.5 text-sm font-black uppercase tracking-[0.08em]",
    "carnival-button-base carnival-button-outline cursor-not-allowed",
  ].join(" "),

  icon: [
    "inline-flex h-11 w-11 items-center justify-center p-0",
    "carnival-button-base carnival-button-ghost bg-card/70",
    "text-muted-foreground hover:text-foreground",
  ].join(" "),

  fab: [
    "fixed bottom-6 right-6 z-30 h-14 w-14 p-0",
    "inline-flex items-center justify-center",
    "carnival-button-base carnival-button-primary carnival-glow",
  ].join(" "),
};

// ============================================================================
// Button component
// ============================================================================

type ButtonVariant = keyof typeof buttonVariants;

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
  loadingText?: string;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", loading, loadingText, className = "", children, disabled, ...props }, ref) => {
    const baseClass = buttonVariants[variant];
    const isDisabled = disabled || loading;
    
    return (
      <button
        ref={ref}
        className={`${baseClass} ${className}`}
        disabled={isDisabled}
        {...props}
      >
        {loading ? (loadingText ?? "Loading…") : children}
      </button>
    );
  }
);

Button.displayName = "Button";

import { forwardRef } from "react";

// ============================================================================
// Button variants
// ============================================================================

export const buttonVariants = {
  primary: [
    "inline-flex items-center justify-center",
    "min-h-11 rounded-[var(--carnival-squircle-radius)] border-[2px] border-[var(--carnival-border)]",
    "bg-[var(--platform-accent)] px-6 py-3 text-sm font-black tracking-[0.02em] text-[#fff7dc]",
    "shadow-none transition-colors hover:bg-[#ee9817] active:bg-[#df8610]",
    "disabled:bg-[var(--platform-accent)]/50 disabled:cursor-not-allowed",
  ].join(" "),
  
  secondary: [
    "inline-flex items-center justify-center",
    "min-h-10 rounded-[var(--carnival-squircle-radius)] border-[2px] border-[var(--carnival-border)]",
    "bg-[#fff7dc] px-5 py-2 text-sm font-black tracking-[0.01em] text-[var(--platform-ink)]",
    "shadow-none transition-colors hover:bg-[#fff0cf] active:bg-[#ffe8bd]",
  ].join(" "),
  
  outline: [
    "inline-flex items-center justify-center",
    "min-h-10 rounded-[var(--carnival-squircle-radius)] border-[2px] border-[var(--carnival-border)] px-5 py-2",
    "bg-transparent text-sm font-black tracking-[0.01em] text-[var(--platform-ink)]",
    "shadow-none transition-colors hover:bg-[#fff7dc] active:bg-[#fff0cf]",
  ].join(" "),
  
  ghost: [
    "inline-flex items-center justify-center",
    "min-h-10 rounded-[var(--carnival-squircle-radius)] px-5 py-2 text-sm font-black tracking-[0.01em]",
    "text-[var(--platform-ink-muted)] transition-colors hover:bg-[#fff0cf] hover:text-[var(--platform-ink)]",
  ].join(" "),
  
  disabled: [
    "inline-flex items-center justify-center",
    "min-h-10 rounded-[var(--carnival-squircle-radius)] border-[2px] border-[var(--platform-border)] bg-muted px-5 py-2",
    "text-sm font-black tracking-[0.01em] text-muted-foreground cursor-not-allowed opacity-70",
  ].join(" "),
  
  icon: [
    "inline-flex items-center justify-center",
    "h-10 w-10 rounded-full border-[2px] border-transparent p-2",
    "text-[var(--platform-ink-muted)] transition-colors",
    "hover:border-[var(--carnival-border)] hover:bg-[#fff7dc] hover:text-[var(--platform-ink)]",
  ].join(" "),
  
  fab: [
    "fixed bottom-6 right-6 h-14 w-14 rounded-full",
    "bg-[var(--platform-accent)] text-[#fff7dc]",
    "flex items-center justify-center border-[2px] border-[var(--carnival-border)]",
    "shadow-none transition-colors hover:bg-[#ee9817]",
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

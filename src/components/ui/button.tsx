import { forwardRef } from "react";

// ============================================================================
// Button variants
// ============================================================================

export const buttonVariants = {
  primary: [
    "inline-flex items-center justify-center",
    "bg-carnival-red hover:bg-carnival-red/80",
    "disabled:bg-carnival-red/50 disabled:cursor-not-allowed",
    "text-white px-6 py-3 rounded-full font-bold transition-colors",
  ].join(" "),
  
  secondary: [
    "inline-flex items-center justify-center",
    "bg-carnival-blue/20 hover:bg-carnival-blue/30",
    "text-foreground px-5 py-2 rounded-full font-semibold transition-colors border border-border",
  ].join(" "),
  
  outline: [
    "inline-flex items-center justify-center",
    "px-5 py-2 rounded-full font-semibold transition-colors",
    "border border-border hover:bg-muted",
  ].join(" "),
  
  ghost: [
    "inline-flex items-center justify-center",
    "px-5 py-2 rounded-full font-semibold transition-colors",
    "text-muted-foreground hover:text-foreground",
  ].join(" "),
  
  disabled: [
    "inline-flex items-center justify-center",
    "bg-muted text-muted-foreground",
    "px-5 py-2 rounded-full font-semibold border border-border cursor-not-allowed",
  ].join(" "),
  
  icon: [
    "inline-flex items-center justify-center",
    "text-muted-foreground hover:text-foreground p-2 transition-colors",
  ].join(" "),
  
  fab: [
    "fixed bottom-6 right-6 h-14 w-14 rounded-full",
    "bg-carnival-red hover:bg-carnival-red/80 text-white",
    "flex items-center justify-center shadow-xl border border-border",
    "carnival-glow transition-all hover:scale-105",
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


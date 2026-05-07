import { forwardRef } from "react";

export const buttonVariants = {
  primary: [
    "inline-flex items-center justify-center",
    "min-h-10 rounded-[var(--carnival-squircle-radius)] border border-[var(--carnival-amber-deep)]",
    "bg-[var(--platform-accent)] px-5 py-2.5 text-sm font-semibold text-white",
    "shadow-sm transition-colors hover:bg-[var(--carnival-amber-deep)] active:bg-[var(--carnival-amber-deep)]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
  ].join(" "),

  secondary: [
    "inline-flex items-center justify-center",
    "min-h-10 rounded-[var(--carnival-squircle-radius)] border border-border",
    "bg-card px-5 py-2.5 text-sm font-semibold text-foreground",
    "shadow-sm transition-colors hover:bg-muted active:bg-muted",
  ].join(" "),

  outline: [
    "inline-flex items-center justify-center",
    "min-h-10 rounded-[var(--carnival-squircle-radius)] border border-border px-5 py-2.5",
    "bg-transparent text-sm font-semibold text-foreground",
    "transition-colors hover:bg-muted active:bg-muted",
  ].join(" "),

  ghost: [
    "inline-flex items-center justify-center",
    "min-h-10 rounded-[var(--carnival-squircle-radius)] px-5 py-2.5 text-sm font-semibold",
    "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
  ].join(" "),

  disabled: [
    "inline-flex items-center justify-center",
    "min-h-10 rounded-[var(--carnival-squircle-radius)] border border-border bg-muted px-5 py-2.5",
    "text-sm font-semibold text-muted-foreground cursor-not-allowed opacity-60",
  ].join(" "),

  icon: [
    "inline-flex items-center justify-center",
    "h-9 w-9 rounded-full border border-transparent p-2",
    "text-muted-foreground transition-colors",
    "hover:border-border hover:bg-muted hover:text-foreground",
  ].join(" "),

  fab: [
    "fixed bottom-6 right-6 h-12 w-12 rounded-full",
    "bg-[var(--platform-accent)] text-white",
    "flex items-center justify-center border border-[var(--carnival-amber-deep)]",
    "shadow-md transition-colors hover:bg-[var(--carnival-amber-deep)]",
  ].join(" "),
};

type ButtonVariant = keyof typeof buttonVariants;

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
  loadingText?: string;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      loading,
      loadingText,
      className = "",
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const baseClass = buttonVariants[variant];
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={`${baseClass} ${className}`}
        disabled={isDisabled}
        {...props}
      >
        {loading ? (loadingText ?? "Loading...") : children}
      </button>
    );
  },
);

Button.displayName = "Button";

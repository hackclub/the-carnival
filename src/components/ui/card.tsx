import * as React from "react";
import { cn } from "@/lib/utils";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
  muted?: boolean;
  variant?: "default" | "flat";
};

export function Card({
  children,
  className,
  interactive = false,
  muted = false,
  variant = "default",
  ...props
}: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        variant === "flat"
          ? "platform-nested-surface overflow-hidden text-card-foreground"
          : "platform-surface-card overflow-hidden text-card-foreground",
        interactive &&
          "cursor-pointer transition-colors hover:bg-[var(--platform-surface-soft)]",
        muted && "opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type CardSectionProps = React.HTMLAttributes<HTMLDivElement>;

export function CardHeader({ className, ...props }: CardSectionProps) {
  return <div data-slot="card-header" className={cn("p-5", className)} {...props} />;
}

export function CardContent({ className, ...props }: CardSectionProps) {
  return <div data-slot="card-content" className={cn("px-5 pb-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: CardSectionProps) {
  return <div data-slot="card-footer" className={cn("px-5 pb-5 pt-0", className)} {...props} />;
}

export function CardTitle({ className, ...props }: CardSectionProps) {
  return <div data-slot="card-title" className={cn("text-base font-bold leading-snug text-foreground", className)} {...props} />;
}

export function CardDescription({ className, ...props }: CardSectionProps) {
  return <div data-slot="card-description" className={cn("text-sm font-semibold leading-6 text-muted-foreground", className)} {...props} />;
}

export function CardAction({ className, ...props }: CardSectionProps) {
  return <div data-slot="card-action" className={cn("self-start justify-self-end", className)} {...props} />;
}

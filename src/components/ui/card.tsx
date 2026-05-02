import * as React from "react";
import { cn } from "@/lib/utils";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
  muted?: boolean;
};

export function Card({
  children,
  className,
  interactive = false,
  muted = false,
  ...props
}: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        "platform-surface-card overflow-hidden text-card-foreground",
        interactive &&
          "card-glow cursor-pointer transition-[background-color,box-shadow,transform] hover:-translate-y-0.5 hover:bg-[var(--platform-surface-soft)]",
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
  return <div data-slot="card-title" className={cn("text-base font-semibold leading-snug", className)} {...props} />;
}

export function CardDescription({ className, ...props }: CardSectionProps) {
  return <div data-slot="card-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function CardAction({ className, ...props }: CardSectionProps) {
  return <div data-slot="card-action" className={cn("self-start justify-self-end", className)} {...props} />;
}

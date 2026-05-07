type DivProps = React.HTMLAttributes<HTMLDivElement>;

type PlatformPageHeadingProps = {
  title: string;
  description?: string;
  className?: string;
};

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function PlatformShell({ className, ...props }: DivProps) {
  return <div {...props} className={joinClasses("platform-shell-bg min-h-screen", className)} />;
}

export function PlatformContent({ className, ...props }: DivProps) {
  return (
    <div
      {...props}
      className={joinClasses("mx-auto w-full max-w-6xl px-6 pb-20 md:px-10", className)}
    />
  );
}

export function PlatformPageHeading({ title, description, className }: PlatformPageHeadingProps) {
  return (
    <header className={joinClasses("platform-page-heading mb-8 px-6 py-5", className)}>
      <h1 className="text-3xl font-bold uppercase tracking-[0.06em] leading-none md:text-4xl">{title}</h1>
      {description ? (
        <p className="mt-3 text-sm font-bold leading-6 text-[var(--platform-ink-muted)] md:text-base">
          {description}
        </p>
      ) : null}
    </header>
  );
}

export function PlatformSurfaceCard({ className, ...props }: DivProps) {
  return <div {...props} className={joinClasses("platform-surface-card", className)} />;
}

export function PlatformDialogSurface({ className, ...props }: DivProps) {
  return <div {...props} className={joinClasses("platform-dialog-surface", className)} />;
}

export function PlatformTableShell({ className, ...props }: DivProps) {
  return <div {...props} className={joinClasses("platform-table-shell", className)} />;
}

export function PlatformNestedSurface({ className, ...props }: DivProps) {
  return <div {...props} className={joinClasses("platform-nested-surface", className)} />;
}

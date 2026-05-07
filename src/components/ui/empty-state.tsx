type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="platform-nested-surface p-8">
      <div className="text-lg font-bold uppercase tracking-[0.06em] text-foreground">{title}</div>
      {description && (
        <div className="mt-2 font-semibold leading-6 text-muted-foreground">{description}</div>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

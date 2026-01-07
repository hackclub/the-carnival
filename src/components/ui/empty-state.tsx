import { Card } from "./card";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Card className="p-8">
      <div className="text-foreground font-semibold text-lg">{title}</div>
      {description && (
        <div className="text-muted-foreground mt-1">{description}</div>
      )}
      {action && <div className="mt-6">{action}</div>}
    </Card>
  );
}


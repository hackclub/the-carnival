type CardProps = {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  muted?: boolean;
  onClick?: () => void;
};

export function Card({ children, className = "", interactive = false, muted = false, onClick }: CardProps) {
  const baseClass = "bg-card border border-border rounded-2xl";
  const interactiveClass = interactive ? "card-glow transition-all hover:bg-muted cursor-pointer" : "";
  const mutedClass = muted ? "opacity-50" : "";
  
  const Component = onClick ? "button" : "div";
  
  return (
    <Component
      className={`${baseClass} ${interactiveClass} ${mutedClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </Component>
  );
}

type CardSectionProps = {
  children: React.ReactNode;
  className?: string;
};

export function CardHeader({ children, className = "" }: CardSectionProps) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}

export function CardContent({ children, className = "" }: CardSectionProps) {
  return <div className={`px-6 pb-6 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = "" }: CardSectionProps) {
  return <div className={`px-6 pb-6 pt-0 ${className}`}>{children}</div>;
}


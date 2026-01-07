import { forwardRef } from "react";

// ============================================================================
// Shared styles
// ============================================================================

const baseInputStyles = [
  "w-full bg-background border border-border rounded-2xl px-4 py-3",
  "text-foreground placeholder:text-muted-foreground",
  "focus:outline-none focus:ring-2 focus:ring-carnival-blue/40",
  "disabled:opacity-50 disabled:cursor-not-allowed",
].join(" ");

const smallInputStyles = [
  "w-full bg-background border border-border rounded-xl px-3 py-2 text-sm",
  "text-foreground placeholder:text-muted-foreground",
  "focus:outline-none focus:ring-2 focus:ring-carnival-blue/40",
  "disabled:opacity-50 disabled:cursor-not-allowed",
].join(" ");

// ============================================================================
// FormLabel
// ============================================================================

type FormLabelProps = {
  children: React.ReactNode;
  className?: string;
  size?: "default" | "small";
};

export function FormLabel({ children, className = "", size = "default" }: FormLabelProps) {
  const sizeClass = size === "small" ? "text-xs" : "text-sm";
  return (
    <div className={`${sizeClass} text-muted-foreground font-medium mb-2 ${className}`}>
      {children}
    </div>
  );
}

// ============================================================================
// Input
// ============================================================================

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  size?: "default" | "small";
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, className = "", size = "default", ...props }, ref) => {
    const inputClass = size === "small" ? smallInputStyles : baseInputStyles;
    
    if (label) {
      return (
        <label className="block">
          <FormLabel size={size}>{label}</FormLabel>
          <input ref={ref} className={`${inputClass} ${className}`} {...props} />
        </label>
      );
    }
    
    return <input ref={ref} className={`${inputClass} ${className}`} {...props} />;
  }
);

Input.displayName = "Input";

// ============================================================================
// Textarea
// ============================================================================

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  size?: "default" | "small";
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, className = "", size = "default", ...props }, ref) => {
    const inputClass = size === "small" ? smallInputStyles : baseInputStyles;
    
    if (label) {
      return (
        <label className="block">
          <FormLabel size={size}>{label}</FormLabel>
          <textarea ref={ref} className={`${inputClass} ${className}`} {...props} />
        </label>
      );
    }
    
    return <textarea ref={ref} className={`${inputClass} ${className}`} {...props} />;
  }
);

Textarea.displayName = "Textarea";

// ============================================================================
// Select
// ============================================================================

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  size?: "default" | "small";
  children: React.ReactNode;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, className = "", size = "default", children, ...props }, ref) => {
    const inputClass = size === "small" ? smallInputStyles : baseInputStyles;
    
    if (label) {
      return (
        <label className="block">
          <FormLabel size={size}>{label}</FormLabel>
          <select ref={ref} className={`${inputClass} ${className}`} {...props}>
            {children}
          </select>
        </label>
      );
    }
    
    return (
      <select ref={ref} className={`${inputClass} ${className}`} {...props}>
        {children}
      </select>
    );
  }
);

Select.displayName = "Select";


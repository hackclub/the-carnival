import { forwardRef } from "react";

// ============================================================================
// Shared styles
// ============================================================================

const baseInputStyles = [
  "w-full carnival-field",
  "placeholder:text-muted-foreground",
  "disabled:opacity-50 disabled:cursor-not-allowed",
].join(" ");

const smallInputStyles = [
  "w-full text-sm carnival-field-sm",
  "placeholder:text-muted-foreground",
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
    <div className={`${sizeClass} mb-2 font-semibold uppercase tracking-[0.06em] text-muted-foreground ${className}`}>
      {children}
    </div>
  );
}

// ============================================================================
// Input
// ============================================================================

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
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

type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
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

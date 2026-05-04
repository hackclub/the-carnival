import { forwardRef } from "react";
import { Input as ShadInput } from "@/components/ui/input";
import { Textarea as ShadTextarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ============================================================================
// Shared styles
// ============================================================================

const baseInputStyles = [
  "carnival-control min-h-11 px-4 py-3",
  "text-sm font-bold text-foreground placeholder:text-muted-foreground",
  "transition-[box-shadow,transform,background-color] hover:bg-[#fffdf2]",
  "disabled:opacity-50 disabled:cursor-not-allowed",
].join(" ");

const smallInputStyles = [
  "carnival-control min-h-9 px-3 py-2 text-sm",
  "font-bold text-foreground placeholder:text-muted-foreground",
  "transition-[box-shadow,transform,background-color] hover:bg-[#fffdf2]",
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
    <div className={cn(sizeClass, "carnival-label mb-2", className)}>
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
          <ShadInput ref={ref} className={cn(inputClass, className)} {...props} />
        </label>
      );
    }
    
    return <ShadInput ref={ref} className={cn(inputClass, className)} {...props} />;
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
          <ShadTextarea ref={ref} className={cn(inputClass, className)} {...props} />
        </label>
      );
    }
    
    return <ShadTextarea ref={ref} className={cn(inputClass, className)} {...props} />;
  }
);

Textarea.displayName = "Textarea";

// ============================================================================
// NativeSelect — styled <select> for controlled/uncontrolled native forms
// ============================================================================

type NativeSelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  label?: string;
  size?: "default" | "small";
  children: React.ReactNode;
};

export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ label, className = "", size = "default", children, ...props }, ref) => {
    const inputClass = size === "small" ? smallInputStyles : baseInputStyles;

    if (label) {
      return (
        <label className="block">
          <FormLabel size={size}>{label}</FormLabel>
          <select ref={ref} className={cn(inputClass, "outline-none", className)} {...props}>
            {children}
          </select>
        </label>
      );
    }

    return (
      <select ref={ref} className={cn(inputClass, "outline-none", className)} {...props}>
        {children}
      </select>
    );
  },
);

NativeSelect.displayName = "NativeSelect";

// ============================================================================
// shadcn Select — prefer these for popover-style dropdowns in client components
// ============================================================================

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

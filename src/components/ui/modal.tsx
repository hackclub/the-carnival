"use client";

import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
};

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
};

export function Modal({ open, onClose, title, description, children, maxWidth = "md" }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(43,17,8,0.34)] p-4 backdrop-blur-sm">
      <div
        className={`carnival-surface w-full ${maxWidthClasses[maxWidth]} max-h-[85vh] overflow-auto`}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card p-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">{title}</h2>
            {description && (
              <p className="text-muted-foreground text-sm mt-1">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="carnival-button-base carnival-button-ghost h-11 w-11 p-0 text-muted-foreground hover:text-foreground"
            type="button"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

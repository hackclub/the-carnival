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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(91,31,10,0.38)] backdrop-blur-sm p-4">
      <div className={`platform-dialog-surface w-full ${maxWidthClasses[maxWidth]} max-h-[85vh] overflow-auto`}>
        <div className="sticky top-0 flex items-center justify-between border-b-[4px] border-[var(--carnival-border)] bg-[rgba(255,247,220,0.96)] p-6">
          <div>
            <h2 className="text-xl font-black uppercase tracking-[0.06em] text-foreground">{title}</h2>
            {description && (
              <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-full border-2 border-transparent p-2 text-muted-foreground transition-colors hover:border-[var(--carnival-border)] hover:bg-[#fff0cf] hover:text-foreground"
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

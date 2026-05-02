"use client";

import { useRef } from "react";
import { Bold, Heading3, Italic, Link as LinkIcon, List } from "lucide-react";
import { FormLabel } from "@/components/ui";
import { cn } from "@/lib/utils";

type RichTextFieldProps = {
  label: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
};

type FormatAction = "bold" | "italic" | "heading" | "list" | "link";

function applyFormat(action: FormatAction, value: string, start: number, end: number) {
  const before = value.slice(0, start);
  const selected = value.slice(start, end);
  const after = value.slice(end);
  const fallback = selected || "text";

  if (action === "bold") return `${before}**${fallback}**${after}`;
  if (action === "italic") return `${before}*${fallback}*${after}`;
  if (action === "heading") return `${before}${start > 0 && !before.endsWith("\n") ? "\n" : ""}### ${fallback}${after}`;
  if (action === "link") return `${before}[${fallback}](https://example.com)${after}`;

  const listText = selected
    ? selected
        .split("\n")
        .map((line) => (line.trim() ? `- ${line.replace(/^\s*[-*]\s+/, "")}` : line))
        .join("\n")
    : "- item";
  return `${before}${listText}${after}`;
}

export function RichTextField({
  label,
  name,
  value,
  onChange,
  required,
  disabled,
  placeholder,
  rows = 7,
}: RichTextFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const format = (action: FormatAction) => {
    const textarea = textareaRef.current;
    if (!textarea || disabled) return;
    const next = applyFormat(action, value, textarea.selectionStart, textarea.selectionEnd);
    onChange(next);
    requestAnimationFrame(() => {
      textarea.focus();
    });
  };

  const buttonClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-lg)] border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div>
      <FormLabel>{label}</FormLabel>
      <div className="overflow-hidden rounded-[var(--radius-xl)] border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        <div className="flex items-center gap-1 border-b border-border bg-muted/30 px-2 py-2">
          <button type="button" className={buttonClass} onClick={() => format("bold")} disabled={disabled} title="Bold">
            <Bold className="h-4 w-4" />
          </button>
          <button type="button" className={buttonClass} onClick={() => format("italic")} disabled={disabled} title="Italic">
            <Italic className="h-4 w-4" />
          </button>
          <button type="button" className={buttonClass} onClick={() => format("heading")} disabled={disabled} title="Heading">
            <Heading3 className="h-4 w-4" />
          </button>
          <button type="button" className={buttonClass} onClick={() => format("list")} disabled={disabled} title="Bulleted list">
            <List className="h-4 w-4" />
          </button>
          <button type="button" className={buttonClass} onClick={() => format("link")} disabled={disabled} title="Link">
            <LinkIcon className="h-4 w-4" />
          </button>
        </div>
        <textarea
          ref={textareaRef}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          rows={rows}
          placeholder={placeholder}
          className={cn(
            "block w-full resize-y bg-transparent px-4 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            "min-h-36",
          )}
        />
      </div>
    </div>
  );
}

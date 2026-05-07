"use client";

import { useCallback } from "react";
import { Copy } from "lucide-react";
import toast from "react-hot-toast";

type CopyableTextProps = {
  text: string;
  className?: string;
};

export default function CopyableText({ text, className }: CopyableTextProps) {
  const onCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copied to clipboard"),
      () => toast.error("Failed to copy"),
    );
  }, [text]);

  return (
    <button
      type="button"
      onClick={onCopy}
      className={`inline-flex items-center gap-1.5 text-foreground hover:text-carnival-blue transition-colors cursor-pointer ${className ?? ""}`}
      title="Click to copy"
    >
      {text}
      <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
    </button>
  );
}

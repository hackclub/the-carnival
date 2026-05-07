"use client";

import { useCallback } from "react";
import { ExternalLink, Copy } from "lucide-react";
import toast from "react-hot-toast";

type LinkChipProps = {
  label: string;
  url: string;
};

export default function LinkChip({ label, url }: LinkChipProps) {
  const onCopy = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(url).then(
        () => toast.success("Copied to clipboard"),
        () => toast.error("Failed to copy"),
      );
    },
    [url],
  );

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 text-xs font-semibold">
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 text-foreground hover:text-carnival-blue transition-colors"
      >
        <ExternalLink className="h-3 w-3 shrink-0" />
        {label}
      </a>
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex items-center justify-center rounded-full p-1 mr-0.5 text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
        title="Copy URL"
      >
        <Copy className="h-3 w-3" />
      </button>
    </span>
  );
}

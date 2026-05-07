"use client";

import { useCallback, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { R2UploadKind } from "@/lib/r2";

type PresignResponse = {
  uploadUrl?: unknown;
  publicUrl?: unknown;
  error?: unknown;
};

export function ScreenshotGrid({
  urls,
  onChange,
  projectId,
  disabled,
  kind = "project_screenshot",
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
  projectId?: string;
  disabled?: boolean;
  kind?: R2UploadKind;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadFile = useCallback(
    async (file: File) => {
      const contentType = file.type || "application/octet-stream";
      if (!contentType.toLowerCase().startsWith("image/")) {
        toast.error("Please choose an image file.");
        return;
      }

      setUploading(true);
      const toastId = toast.loading("Uploading screenshot...");

      try {
        const presignRes = await fetch("/api/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, contentType, projectId }),
        });

        const presignData = (await presignRes
          .json()
          .catch(() => null)) as PresignResponse | null;
        if (!presignRes.ok) {
          const msg =
            typeof presignData?.error === "string"
              ? presignData.error
              : "Failed to start upload.";
          toast.error(msg, { id: toastId });
          setUploading(false);
          return;
        }

        const uploadUrl =
          typeof presignData?.uploadUrl === "string" ? presignData.uploadUrl : "";
        const publicUrl =
          typeof presignData?.publicUrl === "string" ? presignData.publicUrl : "";
        if (!uploadUrl || !publicUrl) {
          toast.error("Upload response missing URLs.", { id: toastId });
          setUploading(false);
          return;
        }

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: file,
        });

        if (!putRes.ok) {
          toast.error(`Upload failed (${putRes.status})`, { id: toastId });
          setUploading(false);
          return;
        }

        onChange([...urls, publicUrl]);
        toast.success("Screenshot uploaded.", { id: toastId });
        setUploading(false);
      } catch {
        toast.error("Upload failed.", { id: toastId });
        setUploading(false);
      }
    },
    [kind, onChange, projectId, urls],
  );

  const handleMultipleFiles = useCallback(
    async (files: FileList) => {
      for (const file of Array.from(files)) {
        await uploadFile(file);
      }
    },
    [uploadFile],
  );

  const onDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (disabled || uploading) return;
      const files = e.dataTransfer.files;
      if (files.length > 0) await handleMultipleFiles(files);
    },
    [disabled, uploading, handleMultipleFiles],
  );

  const removeScreenshot = useCallback(
    (idx: number) => {
      onChange(urls.filter((_, i) => i !== idx));
    },
    [onChange, urls],
  );

  const filtered = urls.filter((u) => u.trim().length > 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {filtered.map((url, idx) => (
          <div
            key={`${url}-${idx}`}
            className="group relative aspect-[4/3] rounded-[var(--radius-xl)] border border-border bg-muted overflow-hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Screenshot ${idx + 1}`}
              className="h-full w-full object-cover"
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => removeScreenshot(idx)}
                className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove screenshot"
              >
                ✕
              </button>
            )}
          </div>
        ))}

        {/* Drop zone / add card */}
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            if (disabled || uploading) return;
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (disabled || uploading) return;
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          onDrop={onDrop}
          onClick={() => {
            if (!disabled && !uploading) inputRef.current?.click();
          }}
          className={[
            "aspect-[4/3] rounded-[var(--radius-xl)] border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors",
            dragOver
              ? "border-carnival-blue/70 bg-carnival-blue/10"
              : "border-border hover:border-muted-foreground/40 bg-muted/40",
            disabled || uploading ? "opacity-50 cursor-not-allowed" : "",
          ].join(" ")}
        >
          {uploading ? (
            <span className="text-xs text-muted-foreground">Uploading...</span>
          ) : (
            <>
              <span className="text-2xl text-muted-foreground/60">+</span>
              <span className="text-xs text-muted-foreground text-center px-2">
                Drop image or click
              </span>
            </>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        disabled={disabled || uploading}
        onChange={async (e) => {
          const files = e.target.files;
          e.target.value = "";
          if (files && files.length > 0) await handleMultipleFiles(files);
        }}
      />
    </div>
  );
}

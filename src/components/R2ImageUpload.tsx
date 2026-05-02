"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Button, Input } from "@/components/ui";
import type { R2UploadKind } from "@/lib/r2";

type PresignResponse = { uploadUrl?: unknown; publicUrl?: unknown; error?: unknown };

export function R2ImageUpload({
  label,
  value,
  onChange,
  kind,
  projectId,
  disabled,
  helperText,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  kind: R2UploadKind;
  projectId?: string;
  disabled?: boolean;
  helperText?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const hasValue = value.trim().length > 0;

  const previewOk = useMemo(() => {
    if (!hasValue) return false;
    try {
      const u = new URL(value);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, [hasValue, value]);

  const pickFile = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      setLocalError(null);
      if (!file) return;
      const contentType = file.type || "application/octet-stream";
      if (!contentType.toLowerCase().startsWith("image/")) {
        setLocalError("Please choose an image file.");
        return;
      }

      setUploading(true);
      const toastId = toast.loading("Preparing upload…");

      try {
        const presignRes = await fetch("/api/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, contentType, projectId }),
        });

        const presignData = (await presignRes.json().catch(() => null)) as PresignResponse | null;
        if (!presignRes.ok) {
          const msg = typeof presignData?.error === "string" ? presignData.error : "Failed to start upload.";
          setLocalError(msg);
          toast.error(msg, { id: toastId });
          setUploading(false);
          return;
        }

        const uploadUrl = typeof presignData?.uploadUrl === "string" ? presignData.uploadUrl : "";
        const publicUrl = typeof presignData?.publicUrl === "string" ? presignData.publicUrl : "";
        if (!uploadUrl || !publicUrl) {
          const msg = "Upload response missing URLs.";
          setLocalError(msg);
          toast.error(msg, { id: toastId });
          setUploading(false);
          return;
        }

        toast.loading("Uploading…", { id: toastId });

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": contentType,
          },
          body: file,
        });

        if (!putRes.ok) {
          const msg = `Upload failed (${putRes.status})`;
          setLocalError(msg);
          toast.error(msg, { id: toastId });
          setUploading(false);
          return;
        }

        onChange(publicUrl);
        toast.success("Uploaded.", { id: toastId });
        setUploading(false);
      } catch {
        const msg = "Upload failed.";
        setLocalError(msg);
        toast.error(msg, { id: toastId });
        setUploading(false);
      }
    },
    [kind, onChange, projectId]
  );

  const onDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (disabled || uploading) return;
      const file = e.dataTransfer.files?.[0];
      if (file) await uploadFile(file);
    },
    [disabled, uploadFile, uploading]
  );

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground font-medium">{label}</div>

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
        className={[
          "rounded-[var(--radius-2xl)] border border-border bg-background p-4",
          "transition-colors",
          dragOver ? "border-carnival-blue/70 bg-carnival-blue/10" : "",
          disabled ? "opacity-60" : "",
        ].join(" ")}
      >
        <div className="flex items-start gap-4">
          <div className="h-20 w-20 rounded-[var(--radius-xl)] border border-border bg-muted overflow-hidden flex items-center justify-center">
            {previewOk ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="text-xs text-muted-foreground text-center px-2">No image</div>
            )}
          </div>

          <div className="flex-1 space-y-2">
            <div className="text-sm text-muted-foreground">
              Drag & drop an image here, or pick a file.
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={pickFile} disabled={disabled} loading={uploading} loadingText="Uploading…">
                Choose file
              </Button>
              {hasValue ? (
                <Button
                  variant="ghost"
                  disabled={disabled || uploading}
                  onClick={() => onChange("")}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={disabled || uploading}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            // allow re-selecting the same file
            e.target.value = "";
            if (file) await uploadFile(file);
          }}
        />
      </div>

      <Input
        label="Image URL"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://…"
        disabled={disabled || uploading}
        size="small"
      />

      {helperText ? <div className="text-xs text-muted-foreground">{helperText}</div> : null}
      {localError ? (
        <div className="text-xs text-red-200 border border-carnival-red/40 bg-carnival-red/10 rounded-[var(--radius-xl)] px-3 py-2">
          {localError}
        </div>
      ) : null}
    </div>
  );
}


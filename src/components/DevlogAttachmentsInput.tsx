"use client";

import { useCallback, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui";

type PresignResponse = { uploadUrl?: unknown; publicUrl?: unknown; error?: unknown };

const DEFAULT_MAX_ATTACHMENTS = 6;

export function DevlogAttachmentsInput({
  projectId,
  value,
  onChange,
  disabled,
  maxAttachments = DEFAULT_MAX_ATTACHMENTS,
}: {
  projectId: string;
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  maxAttachments?: number;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const remaining = Math.max(0, maxAttachments - value.length);
  const atLimit = remaining === 0;

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      if (disabled || uploading) return;

      setLocalError(null);
      const trimmedFiles = files.slice(0, remaining);
      if (!trimmedFiles.length) {
        setLocalError(`You can attach at most ${maxAttachments} files.`);
        return;
      }

      const invalid = trimmedFiles.find(
        (file) => !(file.type || "").toLowerCase().startsWith("image/"),
      );
      if (invalid) {
        setLocalError("Attachments must be image files.");
        return;
      }

      setUploading(true);
      const toastId = toast.loading(
        trimmedFiles.length > 1
          ? `Uploading ${trimmedFiles.length} images…`
          : "Uploading image…",
      );

      const newUrls: string[] = [];
      try {
        for (const file of trimmedFiles) {
          const contentType = file.type || "application/octet-stream";
          const presignRes = await fetch("/api/uploads/presign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind: "devlog_attachment",
              contentType,
              projectId,
            }),
          });
          const presignData = (await presignRes.json().catch(() => null)) as PresignResponse | null;
          if (!presignRes.ok) {
            const msg =
              typeof presignData?.error === "string" ? presignData.error : "Failed to start upload.";
            throw new Error(msg);
          }
          const uploadUrl =
            typeof presignData?.uploadUrl === "string" ? presignData.uploadUrl : "";
          const publicUrl =
            typeof presignData?.publicUrl === "string" ? presignData.publicUrl : "";
          if (!uploadUrl || !publicUrl) {
            throw new Error("Upload response missing URLs.");
          }

          const putRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": contentType },
            body: file,
          });
          if (!putRes.ok) {
            throw new Error(`Upload failed (${putRes.status})`);
          }

          newUrls.push(publicUrl);
        }

        onChange([...value, ...newUrls]);
        toast.success(
          newUrls.length > 1 ? `Uploaded ${newUrls.length} images.` : "Uploaded.",
          { id: toastId },
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed.";
        setLocalError(msg);
        toast.error(msg, { id: toastId });
      } finally {
        setUploading(false);
      }
    },
    [disabled, maxAttachments, onChange, projectId, remaining, uploading, value],
  );

  const pickFile = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const removeAt = useCallback(
    (idx: number) => {
      const next = value.slice();
      next.splice(idx, 1);
      onChange(next);
    },
    [onChange, value],
  );

  const onDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (disabled || uploading) return;
      const files = Array.from(e.dataTransfer.files ?? []);
      if (files.length) await uploadFiles(files);
    },
    [disabled, uploadFiles, uploading],
  );

  return (
    <div className="space-y-3">
      {value.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {value.map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              className="relative rounded-[var(--radius-xl)]  border border-border bg-muted overflow-hidden"
            >
              <div className="aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
              </div>
              <button
                type="button"
                onClick={() => removeAt(idx)}
                disabled={disabled || uploading}
                className="absolute top-2 right-2 inline-flex items-center justify-center rounded-full bg-background/85 px-2 py-1 text-xs font-semibold text-foreground border border-border hover:bg-background disabled:opacity-60"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div
        onDragEnter={(e) => {
          e.preventDefault();
          if (disabled || uploading || atLimit) return;
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (disabled || uploading || atLimit) return;
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={onDrop}
        className={[
          "rounded-[var(--radius-2xl)] border border-dashed border-border bg-background p-4 transition-colors",
          dragOver ? "border-carnival-blue/70 bg-carnival-blue/10" : "",
          disabled || atLimit ? "opacity-60" : "",
        ].join(" ")}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {atLimit
              ? `You've attached the maximum of ${maxAttachments} images.`
              : `Drag & drop images here, or pick files. At least 1 required, up to ${maxAttachments}.`}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={pickFile}
              disabled={disabled || uploading || atLimit}
              loading={uploading}
              loadingText="Uploading…"
            >
              {value.length === 0 ? "Add images" : "Add more"}
            </Button>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={disabled || uploading || atLimit}
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) await uploadFiles(files);
          }}
        />
      </div>

      {localError ? (
        <div className="text-xs text-red-200 border border-carnival-red/40 bg-carnival-red/10 rounded-[var(--radius-xl)] px-3 py-2">
          {localError}
        </div>
      ) : null}
    </div>
  );
}

export default DevlogAttachmentsInput;

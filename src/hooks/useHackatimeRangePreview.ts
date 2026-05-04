"use client";

import { useEffect, useMemo, useState } from "react";
import {
  extractApiError,
  type HackatimeRangePreview,
} from "@/lib/project-form-utils";

type PreviewResponse = {
  project?: {
    hackatimeStartedAt?: string | null;
    hackatimeStoppedAt?: string | null;
    hackatimeTotalSeconds?: number | null;
    hackatimeHours?: { hours?: number; minutes?: number } | null;
  };
  error?: unknown;
} | null;

type UseHackatimeRangePreviewOptions = {
  enabled: boolean;
  endpoint: string;
  body: Record<string, unknown> | null;
  rangeError?: string | null;
  localPreview?: HackatimeRangePreview | null;
  debounceMs?: number;
};

type RemoteState = {
  key: string | null;
  preview: HackatimeRangePreview | null;
  loading: boolean;
  error: string | null;
};

function normalizePreview(data: PreviewResponse): HackatimeRangePreview {
  const hours = data?.project?.hackatimeHours;
  return {
    hackatimeStartedAt: data?.project?.hackatimeStartedAt ?? null,
    hackatimeStoppedAt: data?.project?.hackatimeStoppedAt ?? null,
    hackatimeTotalSeconds:
      typeof data?.project?.hackatimeTotalSeconds === "number"
        ? data.project.hackatimeTotalSeconds
        : null,
    hackatimeHours:
      hours && typeof hours.hours === "number" && typeof hours.minutes === "number"
        ? { hours: hours.hours, minutes: hours.minutes }
        : null,
  };
}

export function useHackatimeRangePreview({
  enabled,
  endpoint,
  body,
  rangeError = null,
  localPreview = null,
  debounceMs = 400,
}: UseHackatimeRangePreviewOptions) {
  const bodyJson = useMemo(() => (body ? JSON.stringify(body) : null), [body]);
  const requestKey = enabled && !rangeError && !localPreview && bodyJson
    ? `${endpoint}:${bodyJson}`
    : null;
  const [remote, setRemote] = useState<RemoteState>({
    key: null,
    preview: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!requestKey || !bodyJson) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setRemote({ key: requestKey, preview: null, loading: true, error: null });
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: bodyJson,
        });
        const data = (await res.json().catch(() => null)) as PreviewResponse;
        if (cancelled) return;
        if (!res.ok) {
          setRemote({
            key: requestKey,
            preview: null,
            loading: false,
            error: extractApiError(data, "Failed to refresh Hackatime hours."),
          });
          return;
        }
        setRemote({
          key: requestKey,
          preview: normalizePreview(data),
          loading: false,
          error: null,
        });
      } catch {
        if (cancelled) return;
        setRemote({
          key: requestKey,
          preview: null,
          loading: false,
          error: "Failed to refresh Hackatime hours.",
        });
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [bodyJson, debounceMs, endpoint, requestKey]);

  if (!enabled) {
    return { preview: null, loading: false, error: null };
  }
  if (rangeError) {
    return { preview: null, loading: false, error: rangeError };
  }
  if (localPreview) {
    return { preview: localPreview, loading: false, error: null };
  }
  if (!requestKey) {
    return { preview: null, loading: false, error: null };
  }
  if (remote.key !== requestKey) {
    return { preview: null, loading: false, error: null };
  }
  return {
    preview: remote.preview,
    loading: remote.loading,
    error: remote.error,
  };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ShieldAlert, ShieldCheck, ShieldQuestion, ShieldX } from "lucide-react";
import {
  TELESCREEN_BAND_LABELS,
  type TelescreenGate,
  type TelescreenSubmissionView,
} from "@/lib/telescreen/shared";

type TelescreenResponse = {
  enabled: boolean;
  gate: TelescreenGate;
  submission: TelescreenSubmissionView | null;
};

const STATE_LABELS: Record<TelescreenSubmissionView["state"], string> = {
  pending: "Not sent yet",
  awaiting_review: "Waiting on fraud review",
  awaiting_outcome: "Scored",
  rejected_fraud: "Rejected as fraud",
  decided: "Decided",
};

const BAND_STYLES = {
  fraud: {
    border: "border-l-4 border-l-red-500",
    pill: "border-red-500/40 bg-red-500/10 text-red-700",
    icon: <ShieldX className="h-5 w-5 text-red-600" aria-hidden="true" />,
  },
  doubtful: {
    border: "border-l-4 border-l-amber-500",
    pill: "border-amber-500/40 bg-amber-500/15 text-amber-700",
    icon: <ShieldAlert className="h-5 w-5 text-amber-600" aria-hidden="true" />,
  },
  clean: {
    border: "border-l-4 border-l-emerald-500",
    pill: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
    icon: <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />,
  },
} as const;

function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
}

function formatHours(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds)) return null;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

/**
 * Staff view of a project's Telescreen (Robert) fraud review: state, trust
 * score band, the fraud reviewer's internal note, and a send/retry control.
 * `onGateChange` lets the grant page block or require acknowledgement.
 */
export default function TelescreenPanel({
  projectId,
  onGateChange,
}: {
  projectId: string;
  onGateChange?: (gate: TelescreenGate | null) => void;
}) {
  const [data, setData] = useState<TelescreenResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (method: "GET" | "POST") => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/review/${encodeURIComponent(projectId)}/telescreen`, {
          method,
          cache: "no-store",
        });
        const json = (await res.json().catch(() => null)) as (TelescreenResponse & { error?: string }) | null;
        if (!res.ok || !json) {
          setError(json?.error ?? "Couldn't load the Telescreen fraud review.");
          onGateChange?.(null);
          return;
        }
        setData(json);
        onGateChange?.(json.gate);
      } catch {
        setError("Couldn't load the Telescreen fraud review.");
        onGateChange?.(null);
      } finally {
        setLoading(false);
      }
    },
    [projectId, onGateChange],
  );

  useEffect(() => {
    void load("GET");
  }, [load]);

  if (data && !data.enabled) return null;

  const s = data?.submission ?? null;
  const band = s?.band ?? null;
  const style = band ? BAND_STYLES[band] : null;
  const canSend = !s || s.state === "pending";

  return (
    <section className={["platform-surface-card p-6 space-y-4", style?.border ?? ""].join(" ")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-foreground font-semibold text-lg">
          {style?.icon ?? <ShieldQuestion className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
          Telescreen fraud review
        </h2>
        <div className="flex items-center gap-2">
          {s && band && s.trustScore !== null ? (
            <span
              className={[
                "rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide",
                style?.pill ?? "",
              ].join(" ")}
            >
              {TELESCREEN_BAND_LABELS[band]} · {s.trustScore}/10
            </span>
          ) : s ? (
            <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {STATE_LABELS[s.state]}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void load("GET")}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-[var(--radius-xl)] border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted/70 disabled:opacity-50"
            title="Read the latest state from Telescreen"
          >
            <RefreshCw className={["h-3.5 w-3.5", loading ? "animate-spin" : ""].join(" ")} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      {!data && loading ? <div className="text-sm text-muted-foreground">Checking Telescreen…</div> : null}

      {data && !s ? (
        <div className="text-sm text-muted-foreground">
          This submission hasn&apos;t been sent to Telescreen. It can&apos;t be granted until a fraud reviewer
          scores it.
        </div>
      ) : null}

      {s ? (
        <div className="space-y-3 text-sm">
          {s.state === "awaiting_review" ? (
            <div className="text-muted-foreground">
              Sent {formatWhen(s.sentAt) ?? ""}. A fraud reviewer scores it in Telescreen; scores of 4 or below
              reject and dismiss the project automatically.
            </div>
          ) : null}
          {s.state === "rejected_fraud" ? (
            <div className="text-foreground font-semibold">
              Rejected as fraud. Carnival dismissed the project and the creator can&apos;t resubmit it.
            </div>
          ) : null}
          {band === "doubtful" && s.state !== "rejected_fraud" ? (
            <div className="text-foreground">
              Doubtful usually means a deduction (for example copied or AI-written code). The granting admin
              must confirm they&apos;ve accounted for it.
            </div>
          ) : null}

          {s.reviewNote ? (
            <div>
              <div className="text-muted-foreground">Fraud reviewer&apos;s note (internal, never shown to the creator)</div>
              <div className="text-foreground whitespace-pre-wrap">{s.reviewNote}</div>
            </div>
          ) : null}

          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 text-xs">
            {s.reviewedAt ? (
              <div>
                <dt className="inline text-muted-foreground">Scored: </dt>
                <dd className="inline text-foreground">{formatWhen(s.reviewedAt)}</dd>
              </div>
            ) : null}
            {formatHours(s.creditedSeconds) ? (
              <div title="Robert counts heartbeats inside its own event window. Informational only; Carnival's hours come from the review.">
                <dt className="inline text-muted-foreground">Telescreen credited: </dt>
                <dd className="inline text-foreground">{formatHours(s.creditedSeconds)}</dd>
              </div>
            ) : null}
            {s.carnivalOutcome ? (
              <div>
                <dt className="inline text-muted-foreground">Carnival decision: </dt>
                <dd className="inline text-foreground">
                  {s.carnivalOutcome}
                  {s.carnivalOutcomeSentAt ? " (recorded in Telescreen)" : " (sent once scored)"}
                </dd>
              </div>
            ) : null}
            {s.robertProjectId ? (
              <div>
                <dt className="inline text-muted-foreground">Robert id: </dt>
                <dd className="inline font-mono text-foreground">{s.robertProjectId}</dd>
              </div>
            ) : null}
          </dl>

          {s.lastError ? (
            <div className="rounded-[var(--radius-xl)] border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
              Last Telescreen error ({formatWhen(s.lastErrorAt)}): {s.lastError}
            </div>
          ) : null}
        </div>
      ) : null}

      {data && canSend ? (
        <button
          type="button"
          onClick={() => void load("POST")}
          disabled={loading}
          className="inline-flex items-center justify-center bg-carnival-blue/15 hover:bg-carnival-blue/25 disabled:opacity-50 text-foreground px-4 py-2 rounded-[var(--radius-xl)] font-semibold transition-colors border border-border"
        >
          {s ? "Retry send to Telescreen" : "Send to Telescreen"}
        </button>
      ) : null}
    </section>
  );
}

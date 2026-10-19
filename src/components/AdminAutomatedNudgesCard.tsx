import { NUDGE_KINDS, NUDGE_KIND_META, toStoredNudgeKind } from "@/lib/notifications/nudges/kinds";
import type { NudgeRunResult } from "@/lib/notifications/nudges/run";
import type { AutomatedNudgeStats } from "@/lib/notifications/nudges/select";

const SKIP_REASON_LABELS: Record<string, string> = {
  deadline_passed: "deadline passed",
  recently_nudged: "nudged in the last 7 days",
  kind_cooldown: "same reminder sent recently",
  kind_cap_reached: "already sent twice",
  not_in_allowlist: "not in test allowlist",
  over_run_cap: "over today's cap",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
        ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" : "border-border bg-background/60 text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
}

/**
 * Server-rendered summary of what the automated nudge run would do today
 * (a dry run of the real planner) plus sends recorded so far. Read-only:
 * runs happen via the Coolify scheduled task (`bun scripts/nudges.js --send`).
 */
export default function AdminAutomatedNudgesCard({
  preview,
  stats,
  error,
}: {
  preview: NudgeRunResult | null;
  stats: AutomatedNudgeStats[];
  error: string | null;
}) {
  const statsByKind = new Map(stats.map((s) => [s.kind, s]));
  const skipped = Object.entries(preview?.skippedByReason ?? {}).filter(([, n]) => (n ?? 0) > 0);

  return (
    <div className="platform-surface-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Automated Slack nudges</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What the daily Coolify scheduled task would send right now. One reminder per
            person per day, at most two per kind, none within 7 days of any other nudge, and nothing after
            the Carnival deadline.
          </p>
        </div>
        {preview ? (
          <div className="flex flex-wrap gap-1.5">
            <Chip ok={preview.sendingEnabled} label={preview.sendingEnabled ? "Sending enabled" : "Dry-run only (NUDGES_ENABLED unset)"} />
            <Chip ok={preview.slackConfigured} label={preview.slackConfigured ? "Slack configured" : "Slack not configured"} />
            <Chip
              ok={preview.daysLeft !== null && preview.daysLeft > 0}
              label={
                preview.daysLeft === null
                  ? "No deadline"
                  : preview.daysLeft > 0
                    ? `${preview.daysLeft} days to deadline`
                    : "Deadline passed — runs stop"
              }
            />
            <Chip ok label={`Cap ${preview.maxSends}/run`} />
            {preview.allowlist ? <Chip ok={false} label={`Test allowlist: ${preview.allowlist.join(", ")}`} /> : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-[var(--radius-xl)] border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800">
          Preview unavailable: {error}
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3">Reminder</th>
              <th className="py-2 pr-3 text-right">Eligible now</th>
              <th className="py-2 pr-3 text-right">Would send today</th>
              <th className="py-2 pr-3 text-right">Sent so far</th>
              <th className="py-2">Last sent</th>
            </tr>
          </thead>
          <tbody>
            {NUDGE_KINDS.map((kind) => {
              const s = statsByKind.get(toStoredNudgeKind(kind));
              return (
                <tr key={kind} className="border-t border-border">
                  <td className="py-2 pr-3">
                    <div className="font-semibold text-foreground">{NUDGE_KIND_META[kind].label}</div>
                    <div className="text-xs text-muted-foreground">{NUDGE_KIND_META[kind].description}</div>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{preview ? preview.candidatesByKind[kind] : "—"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums font-semibold">{preview ? preview.plannedByKind[kind] : "—"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{s?.sent ?? 0}</td>
                  <td className="py-2 text-muted-foreground">{formatDateTime(s?.lastSentAtIso ?? null)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {skipped.length > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Held back today:{" "}
          {skipped.map(([reason, n]) => `${n} ${SKIP_REASON_LABELS[reason] ?? reason}`).join(" · ")}
        </p>
      ) : null}

      {preview && preview.samples.length > 0 ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            Preview copy ({preview.samples.length} variant{preview.samples.length === 1 ? "" : "s"} in today&apos;s plan)
          </summary>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {preview.samples.map((sample) => (
              <div key={`${sample.kind}:${sample.variant}`} className="rounded-[var(--radius-xl)] border border-border bg-background/60 p-3">
                <div className="text-xs font-semibold text-muted-foreground">
                  {NUDGE_KIND_META[sample.kind].label} · {sample.variant}
                </div>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-foreground">{sample.text}</pre>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

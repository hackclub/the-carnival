"use client";

import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import {
  SITE_SETTING_LABELS,
  type SiteSettingKey,
  type SiteSettingRow,
} from "@/lib/site-settings-shared";

// "2026-07-31T23:59:59.000Z" -> "2026-07-31T23:59" for datetime-local inputs.
function isoToInputValue(iso: string): string {
  return iso.replace(/:\d{2}(\.\d{1,3})?Z$/, "");
}

// datetime-local value (interpreted as UTC) -> full ISO. Seconds default to :59
// because these are deadlines ("23:59" should mean the end of that minute).
function inputValueToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const iso = `${value}:59.000Z`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

function formatUtc(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

export default function AdminSettingsClient({ initial }: { initial: SiteSettingRow[] }) {
  const [settings, setSettings] = useState<SiteSettingRow[]>(initial);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(initial.map((row) => [row.key, isoToInputValue(row.valueIso)])),
  );
  const [savingKey, setSavingKey] = useState<SiteSettingKey | null>(null);

  const save = useCallback(
    async (key: SiteSettingKey) => {
      const iso = inputValueToIso(drafts[key] ?? "");
      if (!iso) {
        toast.error("Enter a valid date and time.");
        return;
      }

      setSavingKey(key);
      const toastId = toast.loading("Saving…");
      try {
        const res = await fetch("/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value: iso }),
        });
        const data = (await res.json().catch(() => null)) as
          | { settings?: SiteSettingRow[]; error?: string }
          | null;

        if (!res.ok || !data?.settings) {
          toast.error(data?.error || "Failed to save setting.", { id: toastId });
          setSavingKey(null);
          return;
        }

        setSettings(data.settings);
        setDrafts(
          Object.fromEntries(data.settings.map((row) => [row.key, isoToInputValue(row.valueIso)])),
        );
        toast.success("Saved. Public pages pick it up within a minute.", { id: toastId });
      } catch {
        toast.error("Failed to save setting.", { id: toastId });
      } finally {
        setSavingKey(null);
      }
    },
    [drafts],
  );

  return (
    <div className="space-y-6">
      <div className="platform-surface-card p-5">
        <h2 className="text-lg font-bold text-foreground">Deadlines</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          All times are UTC. Countdowns and page copy read these values live — no code changes or
          redeploys needed.
        </p>

        <div className="mt-4 space-y-4">
          {settings.map((row) => {
            const meta = SITE_SETTING_LABELS[row.key];
            const dirty = drafts[row.key] !== isoToInputValue(row.valueIso);
            return (
              <div
                key={row.key}
                className="rounded-[var(--radius-xl)] border border-border bg-background/60 p-4"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <h3 className="font-bold text-foreground">{meta.label}</h3>
                  <span className="text-xs text-muted-foreground">
                    {row.isDefault
                      ? "using built-in default"
                      : `last updated ${formatUtc(row.updatedAtIso)} UTC`}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="datetime-local"
                    value={drafts[row.key] ?? ""}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [row.key]: e.target.value }))
                    }
                    className="bg-background border border-border rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
                  />
                  <span className="text-xs font-semibold text-muted-foreground">UTC</span>
                  <button
                    type="button"
                    onClick={() => save(row.key)}
                    disabled={savingKey === row.key || !dirty}
                    className="rounded-[var(--radius-xl)] bg-carnival-red px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-carnival-red/80 disabled:cursor-not-allowed disabled:bg-carnival-red/40"
                  >
                    {savingKey === row.key ? "Saving…" : "Save"}
                  </button>
                  {dirty ? (
                    <span className="text-xs text-amber-400">unsaved change</span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Currently: <strong>{formatUtc(row.valueIso)} UTC</strong>
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

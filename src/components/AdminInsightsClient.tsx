"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { OUTREACH_HANDOFF_STORAGE_KEY } from "@/lib/notifications/outreach-shared";
import type {
  ActivationFunnel,
  ActivationSegments,
  NudgeTemplate,
  SegmentKey,
  SegmentUser,
  WeeklySignupPoint,
} from "@/lib/insights";

// Ordered by how actionable each segment is for outreach.
const SEGMENT_ORDER: SegmentKey[] = [
  "stalled_with_hours",
  "verification_blocked",
  "zero_hours",
  "never_activated",
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatHours(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "0h";
  const hours = seconds / 3600;
  return hours >= 10 ? `${Math.round(hours)}h` : `${hours.toFixed(1)}h`;
}

function toPercent(part: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function FunnelCard({ funnel }: { funnel: ActivationFunnel }) {
  const steps = [
    { label: "Signed up", value: funnel.totalUsers, previous: funnel.totalUsers },
    { label: "Hackatime connected", value: funnel.hackatimeConnected, previous: funnel.totalUsers },
    { label: "Created a project", value: funnel.hasProject, previous: funnel.hackatimeConnected },
    { label: "Submitted for review", value: funnel.hasSubmitted, previous: funnel.hasProject },
    { label: "Granted", value: funnel.hasGrant, previous: funnel.hasSubmitted },
  ];

  return (
    <div className="platform-surface-card p-5">
      <h2 className="text-lg font-bold text-foreground">Activation funnel</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Where users drop off between signing up and getting a grant.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {steps.map((step, index) => (
          <div
            key={step.label}
            className="rounded-[var(--radius-xl)] border border-border bg-background/60 p-3"
          >
            <div className="text-2xl font-black tabular-nums text-foreground">{step.value}</div>
            <div className="mt-1 text-xs font-semibold text-muted-foreground">{step.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {index === 0 ? (
                <span>&nbsp;</span>
              ) : (
                <>
                  {toPercent(step.value, step.previous)} of previous ·{" "}
                  {toPercent(step.value, funnel.totalUsers)} overall
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeeklySignupsCard({ points }: { points: WeeklySignupPoint[] }) {
  const maxSignups = Math.max(1, ...points.map((p) => p.signups));
  return (
    <div className="platform-surface-card p-5">
      <h2 className="text-lg font-bold text-foreground">Signups per week</h2>
      <div className="mt-4 flex h-28 items-end gap-1.5">
        {points.map((point) => (
          <div key={point.weekStartIso} className="group relative flex-1">
            <div
              className="w-full rounded-t bg-carnival-red/70 transition-colors group-hover:bg-carnival-red"
              style={{ height: `${Math.max(4, (point.signups / maxSignups) * 100)}%` }}
            />
            <div className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] font-semibold text-background group-hover:block">
              {point.signups} · wk of {formatDate(point.weekStartIso)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{formatDate(points[0]?.weekStartIso ?? null)}</span>
        <span>{formatDate(points[points.length - 1]?.weekStartIso ?? null)}</span>
      </div>
    </div>
  );
}

export default function AdminInsightsClient({
  funnel,
  weeklySignups,
  segments: initialSegments,
  templates,
}: {
  funnel: ActivationFunnel;
  weeklySignups: WeeklySignupPoint[];
  segments: ActivationSegments;
  templates: Record<SegmentKey, NudgeTemplate>;
}) {
  const router = useRouter();
  const segments = initialSegments;
  const [activeSegment, setActiveSegment] = useState<SegmentKey>(SEGMENT_ORDER[0]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const activeUsers = segments[activeSegment];
  const activeTemplate = templates[activeSegment];

  const visibleUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeUsers;
    return activeUsers.filter(
      (u) =>
        (u.name ?? "").toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [activeUsers, search]);

  const reachableVisible = visibleUsers;

  const selectedCount = selectedIds.size;
  const allVisibleSelected =
    reachableVisible.length > 0 && reachableVisible.every((u) => selectedIds.has(u.id));

  const switchSegment = useCallback((key: SegmentKey) => {
    setActiveSegment(key);
    setSelectedIds(new Set());
    setSearch("");
  }, []);

  const toggleUser = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const u of reachableVisible) next.delete(u.id);
      } else {
        for (const u of reachableVisible) next.add(u.id);
      }
      return next;
    });
  }, [allVisibleSelected, reachableVisible]);

  // Hand the selection to /admin/messages, which writes and sends the message.
  const messageSelected = useCallback(() => {
    if (selectedIds.size === 0) {
      toast.error("Select at least one user.");
      return;
    }
    try {
      window.sessionStorage.setItem(OUTREACH_HANDOFF_STORAGE_KEY, JSON.stringify({ userIds: [...selectedIds] }));
    } catch {
      toast.error("Couldn't hand the selection over (browser storage is blocked).");
      return;
    }
    router.push("/admin/messages");
  }, [router, selectedIds]);

  return (
    <div className="space-y-6">
      <FunnelCard funnel={funnel} />
      <WeeklySignupsCard points={weeklySignups} />

      <div className="platform-surface-card p-5">
        <h2 className="text-lg font-bold text-foreground">Outreach segments</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a segment and select users, then open them in Messages to write and send a message.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {SEGMENT_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => switchSegment(key)}
              className={`rounded-[var(--radius-xl)] border px-3 py-1.5 text-sm font-semibold transition-colors ${
                activeSegment === key
                  ? "border-carnival-red bg-carnival-red/15 text-foreground"
                  : "border-border bg-background/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {templates[key].label}
              <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 py-0.5 text-xs tabular-nums">
                {segments[key].length}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-3 text-sm text-muted-foreground">{activeTemplate.description}</p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name or email…"
            className="w-full bg-background border border-border rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
          />
          <button
            type="button"
            onClick={toggleAllVisible}
            className="shrink-0 rounded-[var(--radius-xl)] border border-border bg-background/60 px-3 py-2 text-sm font-semibold text-foreground hover:bg-background"
          >
            {allVisibleSelected ? "Deselect visible" : `Select visible (${reachableVisible.length})`}
          </button>
        </div>

        <div className="mt-3 max-h-96 overflow-y-auto rounded-[var(--radius-xl)] border border-border">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-card text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2" />
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Slack</th>
                <th className="px-3 py-2">Joined</th>
                <th className="px-3 py-2">Last nudged</th>
                {activeSegment === "stalled_with_hours" ? (
                  <th className="px-3 py-2">Stalled work</th>
                ) : (
                  <th className="px-3 py-2">Projects</th>
                )}
              </tr>
            </thead>
            <tbody>
              {visibleUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    {activeUsers.length === 0
                      ? "Nobody in this segment. 🎉"
                      : "No users match your filter."}
                  </td>
                </tr>
              ) : (
                visibleUsers.map((u: SegmentUser) => {
                  const unreachable = false;
                  return (
                    <tr
                      key={u.id}
                      className={`border-t border-border ${unreachable ? "opacity-50" : ""}`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(u.id)}
                          disabled={unreachable}
                          onChange={() => toggleUser(u.id)}
                          className="h-4 w-4 accent-[var(--carnival-red,#e11d48)]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-foreground">{u.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="px-3 py-2">
                        {u.slackId ? (
                          <span className="text-xs font-semibold text-emerald-400">yes</span>
                        ) : (
                          <span className="text-xs font-semibold text-muted-foreground">no</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {formatDate(u.createdAtIso)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {formatDate(u.lastNudgedAtIso)}
                      </td>
                      {activeSegment === "stalled_with_hours" ? (
                        <td className="px-3 py-2">
                          <span className="font-semibold text-foreground">
                            {formatHours(u.stalledSeconds)}
                          </span>{" "}
                          <span className="text-xs text-muted-foreground">
                            on {u.topProjectName ?? "a project"}
                          </span>
                          {u.hasShippedOrGranted ? (
                            <span className="ml-1.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                              has shipped before
                            </span>
                          ) : null}
                        </td>
                      ) : (
                        <td className="px-3 py-2 text-muted-foreground">
                          {u.projectCount ?? 0}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={messageSelected}
            disabled={selectedCount === 0}
            className="rounded-[var(--radius-xl)] bg-carnival-red px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-carnival-red/80 disabled:cursor-not-allowed disabled:bg-carnival-red/40"
          >
            Message {selectedCount} selected in Messages →
          </button>
        </div>
      </div>
    </div>
  );
}

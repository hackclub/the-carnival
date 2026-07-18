"use client";

import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ActivationFunnel,
  ActivationSegments,
  NudgeTemplate,
  SegmentKey,
  SegmentUser,
  WeeklySignupPoint,
} from "@/lib/insights";

type NudgeChannel = "slack" | "email";

type NudgeApiResponse = {
  sent?: string[];
  skipped?: { userId: string; reason: string }[];
  failed?: string[];
  error?: string;
};

// Ordered by how actionable each segment is for outreach.
const SEGMENT_ORDER: SegmentKey[] = [
  "stalled_with_hours",
  "verification_blocked",
  "zero_hours",
  "never_activated",
];

const SKIP_REASON_LABELS: Record<string, string> = {
  recently_nudged: "nudged in the last 7 days",
  no_slack_id: "no Slack ID",
  frozen: "account frozen",
  not_found: "user not found",
};

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
  slackEnabled,
  emailEnabled,
}: {
  funnel: ActivationFunnel;
  weeklySignups: WeeklySignupPoint[];
  segments: ActivationSegments;
  templates: Record<SegmentKey, NudgeTemplate>;
  slackEnabled: boolean;
  emailEnabled: boolean;
}) {
  const [segments, setSegments] = useState<ActivationSegments>(initialSegments);
  const [activeSegment, setActiveSegment] = useState<SegmentKey>(SEGMENT_ORDER[0]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [messages, setMessages] = useState<Record<SegmentKey, string>>(() => {
    const initial = {} as Record<SegmentKey, string>;
    for (const key of SEGMENT_ORDER) initial[key] = templates[key].template;
    return initial;
  });
  const [channel, setChannel] = useState<NudgeChannel>(slackEnabled ? "slack" : "email");
  const [skipRecent, setSkipRecent] = useState(true);
  const [sending, setSending] = useState(false);
  const [confirmingSend, setConfirmingSend] = useState(false);

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

  const reachableVisible = useMemo(
    () => visibleUsers.filter((u) => channel !== "slack" || !!u.slackId),
    [visibleUsers, channel],
  );

  const selectedCount = selectedIds.size;
  const allVisibleSelected =
    reachableVisible.length > 0 && reachableVisible.every((u) => selectedIds.has(u.id));

  const switchSegment = useCallback((key: SegmentKey) => {
    setActiveSegment(key);
    setSelectedIds(new Set());
    setSearch("");
    setConfirmingSend(false);
  }, []);

  const toggleUser = useCallback((id: string) => {
    setConfirmingSend(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllVisible = useCallback(() => {
    setConfirmingSend(false);
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

  const sendNudges = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error("Select at least one user.");
      return;
    }
    if (!confirmingSend) {
      setConfirmingSend(true);
      window.setTimeout(() => setConfirmingSend(false), 6000);
      return;
    }

    setConfirmingSend(false);
    setSending(true);
    const toastId = toast.loading(`Sending ${selectedIds.size} nudge(s)…`);

    try {
      const res = await fetch("/api/admin/insights/nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: [...selectedIds],
          kind: activeSegment,
          channel,
          message: messages[activeSegment],
          skipIfNudgedWithinDays: skipRecent ? 7 : 0,
        }),
      });
      const data = (await res.json().catch(() => null)) as NudgeApiResponse | null;

      if (!res.ok) {
        toast.error(data?.error || "Failed to send nudges.", { id: toastId });
        setSending(false);
        return;
      }

      const sent = data?.sent ?? [];
      const skipped = data?.skipped ?? [];
      const failed = data?.failed ?? [];

      const skippedSummary = skipped.length
        ? ` · ${skipped.length} skipped (${[...new Set(skipped.map((s) => SKIP_REASON_LABELS[s.reason] ?? s.reason))].join(", ")})`
        : "";
      const failedSummary = failed.length ? ` · ${failed.length} failed` : "";
      toast.success(`Sent ${sent.length} nudge(s)${skippedSummary}${failedSummary}`, {
        id: toastId,
        duration: 6000,
      });

      if (sent.length > 0) {
        const nowIso = new Date().toISOString();
        const sentSet = new Set(sent);
        setSegments((prev) => {
          const next = {} as ActivationSegments;
          for (const key of SEGMENT_ORDER) {
            next[key] = prev[key].map((u) =>
              sentSet.has(u.id) ? { ...u, lastNudgedAtIso: nowIso } : u,
            );
          }
          return next;
        });
      }
      setSelectedIds(new Set());
      setSending(false);
    } catch {
      toast.error("Failed to send nudges.", { id: toastId });
      setSending(false);
    }
  }, [selectedIds, confirmingSend, activeSegment, channel, messages, skipRecent]);

  return (
    <div className="space-y-6">
      <FunnelCard funnel={funnel} />
      <WeeklySignupsCard points={weeklySignups} />

      <div className="platform-surface-card p-5">
        <h2 className="text-lg font-bold text-foreground">Outreach segments</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a segment, select users, and send them a Slack DM{emailEnabled ? " or email" : ""}.
          Frozen users and anyone nudged in the last 7 days are skipped automatically.
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
                  const unreachable = channel === "slack" && !u.slackId;
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

        <div className="mt-4 space-y-3">
          <label className="block text-sm font-semibold text-foreground" htmlFor="nudge-message">
            Message{" "}
            <span className="font-normal text-muted-foreground">
              — {"{firstName}"} is replaced per user
            </span>
          </label>
          <textarea
            id="nudge-message"
            value={messages[activeSegment]}
            onChange={(e) => {
              setConfirmingSend(false);
              setMessages((prev) => ({ ...prev, [activeSegment]: e.target.value }));
            }}
            rows={6}
            className="w-full bg-background border border-border rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-full sm:w-44">
              <Select
                value={channel}
                onValueChange={(value) => {
                  setConfirmingSend(false);
                  setChannel(value as NudgeChannel);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slack" disabled={!slackEnabled}>
                    Slack DM{slackEnabled ? "" : " (not configured)"}
                  </SelectItem>
                  <SelectItem value="email" disabled={!emailEnabled}>
                    Email{emailEnabled ? "" : " (not configured)"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={skipRecent}
                onChange={(e) => setSkipRecent(e.target.checked)}
                className="h-4 w-4"
              />
              Skip anyone nudged in the last 7 days
            </label>

            <div className="sm:ml-auto">
              <button
                type="button"
                onClick={sendNudges}
                disabled={sending || selectedCount === 0}
                className="rounded-[var(--radius-xl)] bg-carnival-red px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-carnival-red/80 disabled:cursor-not-allowed disabled:bg-carnival-red/40"
              >
                {sending
                  ? "Sending…"
                  : confirmingSend
                    ? `Really send to ${selectedCount} user(s)?`
                    : `Send to ${selectedCount} selected`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

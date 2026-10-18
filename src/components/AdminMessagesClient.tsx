"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  OUTREACH_HANDOFF_STORAGE_KEY,
  OUTREACH_MAX_MESSAGE_LENGTH,
  OUTREACH_REASON_LABELS,
  mergeRecipients,
  parseSlackIdList,
  renderOutreachMessage,
  type DraftRecipient,
  type OutreachChannel,
} from "@/lib/notifications/outreach-shared";
import type {
  ExclusionRow,
  OutreachRecipientRow,
  OutreachSendSummary,
  SelfOptOutRow,
} from "@/lib/notifications/outreach";

export type MessagesPageData = {
  users: { id: string; name: string; email: string; slackId: string | null; isFrozen: boolean }[];
  segments: { key: string; label: string; description: string; userIds: string[] }[];
  exclusions: { excluded: ExclusionRow[]; selfOptedOut: SelfOptOutRow[] };
  sends: OutreachSendSummary[];
  slackEnabled: boolean;
  emailEnabled: boolean;
};

type ResolvedRecipient = DraftRecipient & { status: "pending" | "skipped"; reason: string | null };

const card = "platform-surface-card p-5";
const inputClass =
  "w-full bg-background border border-border rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40";
const smallButton =
  "rounded-[var(--radius-xl)] border border-border bg-background/60 px-3 py-2 text-sm font-semibold text-foreground hover:bg-background disabled:cursor-not-allowed disabled:opacity-50";
const dangerButton =
  "rounded-[var(--radius-xl)] bg-carnival-red px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-carnival-red/80 disabled:cursor-not-allowed disabled:bg-carnival-red/40";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function reasonLabel(reason: string | null): string {
  if (!reason) return "";
  return OUTREACH_REASON_LABELS[reason] ?? reason;
}

function recipientLabel(r: { name: string | null; slackId: string | null; email?: string | null }): string {
  return r.name ?? r.slackId ?? r.email ?? "Unknown";
}

async function postJson<T>(url: string, body: unknown, method = "POST"): Promise<{ ok: boolean; data: T & { error?: string } }> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, data };
}

export default function AdminMessagesClient({ initial }: { initial: MessagesPageData }) {
  const usersById = useMemo(() => new Map(initial.users.map((u) => [u.id, u])), [initial.users]);
  const usersBySlack = useMemo(
    () => new Map(initial.users.filter((u) => u.slackId).map((u) => [u.slackId as string, u])),
    [initial.users],
  );
  const toDraft = useCallback(
    (u: MessagesPageData["users"][number]): DraftRecipient => ({
      userId: u.id,
      slackId: u.slackId,
      name: u.name,
      email: u.email,
    }),
    [],
  );

  const [sends, setSends] = useState(initial.sends);
  // Bumped when the exclusion list changes so the compose box re-checks recipients.
  const [exclusionsVersion, setExclusionsVersion] = useState(0);
  const onExclusionsChanged = useCallback(() => setExclusionsVersion((v) => v + 1), []);
  const refreshSends = useCallback(async () => {
    const res = await fetch("/api/admin/messages", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { sends: OutreachSendSummary[] };
    setSends(data.sends);
  }, []);

  return (
    <div className="space-y-6">
      <RunNowPanel onStarted={refreshSends} slackEnabled={initial.slackEnabled} />
      <ComposePanel
        initial={initial}
        usersById={usersById}
        usersBySlack={usersBySlack}
        toDraft={toDraft}
        onSent={refreshSends}
        exclusionsVersion={exclusionsVersion}
      />
      <ExclusionsPanel initial={initial.exclusions} usersBySlack={usersBySlack} onChanged={onExclusionsChanged} />
      <HistoryPanel sends={sends} onRefresh={refreshSends} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Run the automated nudges now
// ---------------------------------------------------------------------------

function RunNowPanel({ onStarted, slackEnabled }: { onStarted: () => Promise<void>; slackEnabled: boolean }) {
  const [maxSends, setMaxSends] = useState("");
  const [allowlist, setAllowlist] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const start = useCallback(async () => {
    if (!confirming) {
      setConfirming(true);
      window.setTimeout(() => setConfirming(false), 6000);
      return;
    }
    setConfirming(false);
    setBusy(true);
    const { ok, data } = await postJson<{ id?: string }>("/api/admin/messages/automated-run", {
      maxSends: maxSends.trim() || undefined,
      allowlist: allowlist.trim() || undefined,
    });
    setBusy(false);
    if (!ok) {
      toast.error(data.error ?? "Failed to start the run.");
      return;
    }
    toast.success("Run started. Progress shows under History.");
    await onStarted();
  }, [allowlist, confirming, maxSends, onStarted]);

  return (
    <div className={card}>
      <h2 className="text-lg font-bold text-foreground">Send today&apos;s automated run now</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Runs exactly what the daily scheduled task runs: same cooldowns, opt-outs, exclusions and deadline stop.
        It can&apos;t overlap the scheduled run. Without <code>NUDGES_ENABLED=true</code> on the server it only
        records a dry run.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-foreground">Cap (optional)</span>
          <input
            className={inputClass}
            inputMode="numeric"
            placeholder="200"
            value={maxSends}
            onChange={(e) => setMaxSends(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-foreground">Only these Slack IDs (optional, for testing)</span>
          <input
            className={inputClass}
            placeholder="U0123ABCD, U0456EFGH"
            value={allowlist}
            onChange={(e) => setAllowlist(e.target.value)}
          />
        </label>
        <button type="button" className={dangerButton} onClick={start} disabled={busy || !slackEnabled}>
          {busy ? "Starting…" : confirming ? "Really start the run?" : "Run now"}
        </button>
      </div>
      {!slackEnabled ? <p className="mt-2 text-xs text-muted-foreground">Slack is not configured.</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Compose a hand-written message
// ---------------------------------------------------------------------------

function ComposePanel({
  initial,
  usersById,
  usersBySlack,
  toDraft,
  onSent,
  exclusionsVersion,
}: {
  initial: MessagesPageData;
  usersById: Map<string, MessagesPageData["users"][number]>;
  usersBySlack: Map<string, MessagesPageData["users"][number]>;
  toDraft: (u: MessagesPageData["users"][number]) => DraftRecipient;
  onSent: () => Promise<void>;
  exclusionsVersion: number;
}) {
  const [message, setMessage] = useState("Hey {firstName}! 🎪 ");
  const [channel, setChannel] = useState<OutreachChannel>(initial.slackEnabled ? "slack" : "email");
  const [skipRecent, setSkipRecent] = useState(false);
  const [drafts, setDrafts] = useState<DraftRecipient[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [resolved, setResolved] = useState<ResolvedRecipient[] | null>(null);
  const [resolving, setResolving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeSend, setActiveSend] = useState<string | null>(null);
  const [progress, setProgress] = useState<OutreachSendSummary | null>(null);

  // Recipients handed over from /admin/users or /admin/insights.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      let raw: string | null = null;
      try {
        raw = window.sessionStorage.getItem(OUTREACH_HANDOFF_STORAGE_KEY);
        window.sessionStorage.removeItem(OUTREACH_HANDOFF_STORAGE_KEY);
      } catch {
        raw = null;
      }
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as { userIds?: unknown };
        const ids = Array.isArray(parsed.userIds) ? parsed.userIds.filter((v): v is string => typeof v === "string") : [];
        const handed = ids.map((id) => usersById.get(id)).filter((u): u is NonNullable<typeof u> => Boolean(u));
        if (handed.length) {
          setDrafts((prev) => mergeRecipients(prev, handed.map(toDraft)));
          toast.success(`Added ${handed.length} recipient(s) from your selection.`);
        }
      } catch {
        // ignore a malformed handoff
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [toDraft, usersById]);

  // Re-check recipients (names, exclusions, frozen, …) whenever the list changes.
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (drafts.length === 0) {
        setResolved(null);
        return;
      }
      setResolving(true);
      const { ok, data } = await postJson<{ recipients?: ResolvedRecipient[] }>("/api/admin/messages/resolve", {
        channel,
        userIds: drafts.filter((d) => d.userId).map((d) => d.userId),
        slackIds: drafts.filter((d) => !d.userId).map((d) => d.slackId),
        skipRecentDays: skipRecent ? 7 : 0,
      });
      setResolving(false);
      if (ok && data.recipients) setResolved(data.recipients);
      else if (!ok) toast.error(data.error ?? "Couldn't check recipients.");
    }, 400);
    return () => window.clearTimeout(timer);
  }, [channel, drafts, skipRecent, exclusionsVersion]);

  // Poll the send we just started until it finishes.
  useEffect(() => {
    if (!activeSend) return;
    let cancelled = false;
    const tick = async () => {
      const res = await fetch(`/api/admin/messages/${encodeURIComponent(activeSend)}`, { cache: "no-store" });
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { send: OutreachSendSummary };
      setProgress(data.send);
      if (data.send.status !== "running") {
        setActiveSend(null);
        await onSent();
        toast.success(`Finished: ${data.send.counts.sent} sent, ${data.send.counts.skipped} skipped, ${data.send.counts.failed} failed.`);
      }
    };
    void tick();
    const interval = window.setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeSend, onSent]);

  const addPasted = useCallback(() => {
    const parsed = parseSlackIdList(pasteText);
    if (parsed.ids.length === 0) {
      toast.error(parsed.invalid.length ? `Not Slack user IDs: ${parsed.invalid.slice(0, 5).join(", ")}` : "Paste at least one Slack ID.");
      return;
    }
    const additions = parsed.ids.map((id) => {
      const u = usersBySlack.get(id);
      return u ? toDraft(u) : { userId: null, slackId: id, name: null, email: null };
    });
    setDrafts((prev) => mergeRecipients(prev, additions));
    setPasteText("");
    setConfirming(false);
    const unmatched = additions.filter((a) => !a.userId).length;
    toast.success(
      `Added ${additions.length}${unmatched ? ` (${unmatched} with no Carnival account)` : ""}${
        parsed.invalid.length ? ` · ignored ${parsed.invalid.length} invalid` : ""
      }.`,
    );
  }, [pasteText, toDraft, usersBySlack]);

  const userMatches = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return [];
    return initial.users
      .filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.slackId ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [initial.users, userSearch]);

  const addUser = useCallback(
    (u: MessagesPageData["users"][number]) => {
      setDrafts((prev) => mergeRecipients(prev, [toDraft(u)]));
      setUserSearch("");
      setConfirming(false);
    },
    [toDraft],
  );

  const addSegment = useCallback(
    (segment: MessagesPageData["segments"][number]) => {
      const additions = segment.userIds
        .map((id) => usersById.get(id))
        .filter((u): u is NonNullable<typeof u> => Boolean(u))
        .map(toDraft);
      setDrafts((prev) => mergeRecipients(prev, additions));
      setConfirming(false);
      toast.success(`Added ${additions.length} from "${segment.label}".`);
    },
    [toDraft, usersById],
  );

  const removeDraft = useCallback((d: DraftRecipient) => {
    setDrafts((prev) => prev.filter((p) => (d.userId ? p.userId !== d.userId : p.userId || p.slackId !== d.slackId)));
    setConfirming(false);
  }, []);

  const resolvedByKey = useMemo(() => {
    const m = new Map<string, ResolvedRecipient>();
    for (const r of resolved ?? []) m.set(r.userId ? `u:${r.userId}` : `s:${r.slackId}`, r);
    return m;
  }, [resolved]);
  const willReceive = (resolved ?? []).filter((r) => r.status === "pending").length;
  const willSkip = (resolved ?? []).filter((r) => r.status === "skipped").length;
  const previewRecipient = (resolved ?? []).find((r) => r.status === "pending") ?? drafts[0] ?? { name: "Ada Lovelace" };

  const send = useCallback(async () => {
    if (drafts.length === 0) return toast.error("Add at least one recipient.");
    if (message.trim().length < 10) return toast.error("Write a message of at least 10 characters.");
    if (!confirming) {
      setConfirming(true);
      window.setTimeout(() => setConfirming(false), 6000);
      return;
    }
    setConfirming(false);
    setSending(true);
    const { ok, data } = await postJson<{ id?: string; total?: number }>("/api/admin/messages", {
      message,
      channel,
      userIds: drafts.filter((d) => d.userId).map((d) => d.userId),
      slackIds: drafts.filter((d) => !d.userId).map((d) => d.slackId),
      skipRecentDays: skipRecent ? 7 : 0,
    });
    setSending(false);
    if (!ok || !data.id) {
      toast.error(data.error ?? "Failed to start the send.");
      return;
    }
    toast.success("Sending in the background. You can leave this page.");
    setActiveSend(data.id);
    setDrafts([]);
    await onSent();
  }, [channel, confirming, drafts, message, onSent, skipRecent]);

  return (
    <div className={card}>
      <h2 className="text-lg font-bold text-foreground">Write a message</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick recipients from any mix of the sources below. People on the exclusion list and frozen accounts are
        always skipped. Messages go out in the background at about one per second.
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-foreground" htmlFor="paste-ids">
              Paste Slack IDs
            </label>
            <textarea
              id="paste-ids"
              rows={3}
              className={inputClass}
              placeholder={"U0123ABCD, U0456EFGH\nor one per line, <@U…> mentions work too"}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <button type="button" className={`${smallButton} mt-2`} onClick={addPasted}>
              Add these IDs
            </button>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-foreground" htmlFor="user-search">
              Add a user
            </label>
            <input
              id="user-search"
              className={inputClass}
              placeholder="Search by name, email or Slack ID…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
            {userMatches.length > 0 ? (
              <ul className="mt-2 divide-y divide-border rounded-[var(--radius-xl)] border border-border">
                {userMatches.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-background/60"
                      onClick={() => addUser(u)}
                    >
                      <span>
                        <span className="font-semibold text-foreground">{u.name}</span>{" "}
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">{u.slackId ?? "no Slack ID"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div>
            <span className="mb-1 block text-sm font-semibold text-foreground">Add a segment</span>
            <div className="flex flex-wrap gap-2">
              {initial.segments.map((s) => (
                <button key={s.key} type="button" className={smallButton} title={s.description} onClick={() => addSegment(s)}>
                  {s.label}
                  <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 py-0.5 text-xs tabular-nums">
                    {s.userIds.length}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              Recipients ({drafts.length})
              {resolved ? (
                <span className="ml-2 font-normal text-muted-foreground">
                  {willReceive} will receive · {willSkip} skipped
                </span>
              ) : resolving ? (
                <span className="ml-2 font-normal text-muted-foreground">checking…</span>
              ) : null}
            </span>
            {drafts.length ? (
              <button type="button" className="text-xs font-semibold text-muted-foreground hover:text-foreground" onClick={() => setDrafts([])}>
                Clear all
              </button>
            ) : null}
          </div>
          <div className="max-h-80 overflow-y-auto rounded-[var(--radius-xl)] border border-border">
            {drafts.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">No recipients yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {drafts.map((d) => {
                  const r = resolvedByKey.get(d.userId ? `u:${d.userId}` : `s:${d.slackId}`);
                  return (
                    <li key={d.userId ?? d.slackId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className={`font-semibold ${r?.status === "skipped" ? "text-muted-foreground line-through" : "text-foreground"}`}>
                          {recipientLabel(d)}
                        </span>{" "}
                        {!d.userId ? <span className="text-xs text-amber-600">no Carnival account</span> : null}
                        {r?.status === "skipped" ? (
                          <span className="ml-1 rounded-full bg-carnival-red/10 px-1.5 py-0.5 text-[11px] font-semibold text-carnival-red">
                            {reasonLabel(r.reason)}
                          </span>
                        ) : null}
                      </span>
                      <button type="button" className="text-xs text-muted-foreground hover:text-carnival-red" onClick={() => removeDraft(d)}>
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold text-foreground" htmlFor="outreach-message">
            Message <span className="font-normal text-muted-foreground">— {"{firstName}"} is replaced per person</span>
          </label>
          <textarea
            id="outreach-message"
            rows={7}
            maxLength={OUTREACH_MAX_MESSAGE_LENGTH}
            className={inputClass}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setConfirming(false);
            }}
          />
        </div>
        <div>
          <span className="mb-1 block text-sm font-semibold text-foreground">
            Preview <span className="font-normal text-muted-foreground">for {recipientLabel(previewRecipient as DraftRecipient)}</span>
          </span>
          <pre className="min-h-[10rem] whitespace-pre-wrap rounded-[var(--radius-xl)] border border-border bg-background/60 p-3 font-sans text-sm text-foreground">
            {renderOutreachMessage(message, { name: (previewRecipient as DraftRecipient).name ?? null })}
          </pre>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          className={`${inputClass} sm:w-48`}
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value as OutreachChannel);
            setConfirming(false);
          }}
        >
          <option value="slack" disabled={!initial.slackEnabled}>
            Slack DM{initial.slackEnabled ? "" : " (not configured)"}
          </option>
          <option value="email" disabled={!initial.emailEnabled}>
            Email{initial.emailEnabled ? "" : " (not configured)"}
          </option>
        </select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="h-4 w-4" checked={skipRecent} onChange={(e) => setSkipRecent(e.target.checked)} />
          Skip anyone nudged in the last 7 days
        </label>
        <div className="sm:ml-auto">
          <button type="button" className={dangerButton} onClick={send} disabled={sending || drafts.length === 0 || Boolean(activeSend)}>
            {sending
              ? "Starting…"
              : confirming
                ? `Really send to ${resolved ? willReceive : drafts.length}?`
                : `Send to ${resolved ? willReceive : drafts.length}`}
          </button>
        </div>
      </div>

      {progress ? (
        <div className="mt-4 rounded-[var(--radius-xl)] border border-border bg-background/60 px-3 py-2 text-sm">
          <span className="font-semibold text-foreground">
            {progress.status === "running" ? "Sending…" : `Send ${progress.status}`}
          </span>{" "}
          <span className="text-muted-foreground">
            {progress.counts.sent} sent · {progress.counts.pending} pending · {progress.counts.skipped} skipped ·{" "}
            {progress.counts.failed} failed
          </span>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Exclusion list
// ---------------------------------------------------------------------------

function ExclusionsPanel({
  initial,
  usersBySlack,
  onChanged,
}: {
  initial: MessagesPageData["exclusions"];
  usersBySlack: Map<string, MessagesPageData["users"][number]>;
  onChanged: () => void;
}) {
  const [data, setData] = useState(initial);
  const [ids, setIds] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const preview = useMemo(() => parseSlackIdList(ids), [ids]);

  const add = useCallback(async () => {
    if (preview.ids.length === 0) {
      toast.error(preview.invalid.length ? `Not Slack user IDs: ${preview.invalid.slice(0, 5).join(", ")}` : "Enter at least one Slack ID.");
      return;
    }
    setBusy(true);
    const { ok, data: res } = await postJson<
      MessagesPageData["exclusions"] & { added?: string[]; alreadyExcluded?: string[] }
    >("/api/admin/messages/exclusions", { slackIds: preview.ids, note: note.trim() || undefined });
    setBusy(false);
    if (!ok) {
      toast.error(res.error ?? "Failed to update the exclusion list.");
      return;
    }
    setData({ excluded: res.excluded, selfOptedOut: res.selfOptedOut });
    onChanged();
    setIds("");
    setNote("");
    toast.success(
      `Excluded ${res.added?.length ?? 0}${res.alreadyExcluded?.length ? ` · ${res.alreadyExcluded.length} already on the list` : ""}.`,
    );
  }, [note, onChanged, preview]);

  const remove = useCallback(async (slackId: string) => {
    if (!window.confirm(`Remove ${slackId} from the exclusion list? They can receive nudges again.`)) return;
    const res = await fetch(`/api/admin/messages/exclusions?slackId=${encodeURIComponent(slackId)}`, { method: "DELETE" });
    const body = (await res.json().catch(() => ({}))) as MessagesPageData["exclusions"] & { error?: string };
    if (!res.ok) {
      toast.error(body.error ?? "Failed to remove.");
      return;
    }
    setData({ excluded: body.excluded, selfOptedOut: body.selfOptedOut });
    onChanged();
    toast.success(`${slackId} can receive nudges again.`);
  }, [onChanged]);

  return (
    <div className={card}>
      <h2 className="text-lg font-bold text-foreground">Excluded people</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Slack IDs here never receive any nudge: not the automated run, not &quot;run now&quot;, and not messages
        written on this page. Add people who ask you to stop.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-foreground">Slack IDs</span>
          <input className={inputClass} placeholder="U0123ABCD, <@U0456EFGH>" value={ids} onChange={(e) => setIds(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-foreground">Note (optional)</span>
          <input className={inputClass} placeholder="Asked to stop on Oct 20" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button type="button" className={smallButton} onClick={add} disabled={busy}>
          {busy ? "Adding…" : "Exclude"}
        </button>
      </div>
      {preview.ids.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {preview.ids
            .map((id) => {
              const u = usersBySlack.get(id);
              return u ? `${id} (${u.name})` : `${id} (no Carnival account)`;
            })
            .join(" · ")}
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-[var(--radius-xl)] border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-card text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Person</th>
              <th className="px-3 py-2">Slack ID</th>
              <th className="px-3 py-2">Note</th>
              <th className="px-3 py-2">Added</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data.excluded.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  Nobody is excluded.
                </td>
              </tr>
            ) : (
              data.excluded.map((x) => (
                <tr key={x.slackId} className="border-t border-border">
                  <td className="px-3 py-2 font-semibold text-foreground">
                    {x.userName ?? <span className="font-normal text-amber-600">no Carnival account</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{x.slackId}</td>
                  <td className="px-3 py-2 text-muted-foreground">{x.note ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {formatDateTime(x.createdAtIso)}
                    {x.addedByName ? ` · ${x.addedByName}` : ""}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" className="text-xs font-semibold text-muted-foreground hover:text-carnival-red" onClick={() => void remove(x.slackId)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data.selfOptedOut.length ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            Opted out themselves ({data.selfOptedOut.length})
          </summary>
          <p className="mt-1 text-xs text-muted-foreground">
            These people turned off automated reminders on their Account page. They still receive messages you write
            here unless you also exclude them.
          </p>
          <ul className="mt-2 text-sm text-muted-foreground">
            {data.selfOptedOut.map((u) => (
              <li key={u.userId}>
                <span className="text-foreground">{u.name}</span> · {u.slackId ?? "no Slack ID"} · {u.email}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. History
// ---------------------------------------------------------------------------

function HistoryPanel({ sends, onRefresh }: { sends: OutreachSendSummary[]; onRefresh: () => Promise<void> }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ send: OutreachSendSummary & { message: string | null }; recipients: OutreachRecipientRow[] } | null>(null);
  const anyRunning = sends.some((s) => s.status === "running");

  // Keep counts fresh while anything is still sending.
  useEffect(() => {
    if (!anyRunning) return;
    const interval = window.setInterval(() => void onRefresh(), 4000);
    return () => window.clearInterval(interval);
  }, [anyRunning, onRefresh]);

  const open = useCallback(async (id: string) => {
    if (openId === id) {
      setOpenId(null);
      setDetail(null);
      return;
    }
    setOpenId(id);
    setDetail(null);
    const res = await fetch(`/api/admin/messages/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (res.ok) setDetail(await res.json());
  }, [openId]);

  const resume = useCallback(async (id: string) => {
    const { ok, data } = await postJson<{ ok?: boolean }>(`/api/admin/messages/${encodeURIComponent(id)}`, { action: "resume" });
    if (!ok) {
      toast.error(data.error ?? "Failed to resume.");
      return;
    }
    toast.success("Resumed. Only people still pending will be messaged.");
    await onRefresh();
  }, [onRefresh]);

  return (
    <div className={card}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">History</h2>
        <button type="button" className={smallButton} onClick={() => void onRefresh()}>
          Refresh
        </button>
      </div>
      <div className="mt-4 overflow-x-auto rounded-[var(--radius-xl)] border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-card text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">What</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Sent</th>
              <th className="px-3 py-2 text-right">Skipped</th>
              <th className="px-3 py-2 text-right">Failed</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {sends.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Nothing sent from here yet.
                </td>
              </tr>
            ) : (
              sends.map((s) => (
                <HistoryRow key={s.id} send={s} open={openId === s.id} detail={openId === s.id ? detail : null} onToggle={open} onResume={resume} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HistoryRow({
  send,
  open,
  detail,
  onToggle,
  onResume,
}: {
  send: OutreachSendSummary;
  open: boolean;
  detail: { send: OutreachSendSummary & { message: string | null }; recipients: OutreachRecipientRow[] } | null;
  onToggle: (id: string) => void;
  onResume: (id: string) => void;
}) {
  const summaryError = typeof send.summary.error === "string" ? send.summary.error : null;
  const dryRun = send.kind === "automated" && send.summary.dryRun === true;
  return (
    <>
      <tr className="border-t border-border align-top">
        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
          {formatDateTime(send.createdAtIso)}
          {send.createdByName ? <div className="text-xs">{send.createdByName}</div> : null}
        </td>
        <td className="px-3 py-2">
          <div className="font-semibold text-foreground">
            {send.kind === "automated" ? "Automated run (manual)" : `Message · ${send.channel === "email" ? "email" : "Slack"}`}
            {dryRun ? <span className="ml-1 text-xs font-normal text-muted-foreground">dry run, sending disabled</span> : null}
          </div>
          {send.messagePreview ? <div className="line-clamp-2 text-xs text-muted-foreground">{send.messagePreview}</div> : null}
          {summaryError ? <div className="text-xs text-carnival-red">{summaryError}</div> : null}
        </td>
        <td className="px-3 py-2 whitespace-nowrap">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              send.status === "completed"
                ? "bg-emerald-500/10 text-emerald-700"
                : send.status === "running"
                  ? "bg-carnival-blue/10 text-carnival-blue"
                  : "bg-carnival-red/10 text-carnival-red"
            }`}
          >
            {send.status}
            {send.status === "running" && send.counts.pending ? ` · ${send.counts.pending} left` : ""}
          </span>
        </td>
        <td className="px-3 py-2 text-right tabular-nums">{send.counts.sent}</td>
        <td className="px-3 py-2 text-right tabular-nums">{send.counts.skipped}</td>
        <td className="px-3 py-2 text-right tabular-nums">{send.counts.failed}</td>
        <td className="px-3 py-2 whitespace-nowrap text-right">
          {send.status === "interrupted" && send.kind === "custom" ? (
            <button type="button" className="mr-3 text-xs font-semibold text-carnival-blue hover:underline" onClick={() => onResume(send.id)}>
              Resume
            </button>
          ) : null}
          <button type="button" className="text-xs font-semibold text-muted-foreground hover:text-foreground" onClick={() => onToggle(send.id)}>
            {open ? "Hide" : "Details"}
          </button>
        </td>
      </tr>
      {open ? (
        <tr className="border-t border-border bg-background/40">
          <td colSpan={7} className="px-3 py-3">
            {!detail ? (
              <span className="text-sm text-muted-foreground">Loading…</span>
            ) : (
              <div className="space-y-3">
                {detail.send.message ? (
                  <pre className="whitespace-pre-wrap rounded-[var(--radius-xl)] border border-border bg-background/60 p-3 font-sans text-xs text-foreground">
                    {detail.send.message}
                  </pre>
                ) : null}
                {detail.recipients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recipients recorded.</p>
                ) : (
                  <ul className="max-h-72 overflow-y-auto text-sm">
                    {detail.recipients.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-baseline gap-x-2 border-b border-border py-1 last:border-0">
                        <span className="font-semibold text-foreground">{recipientLabel(r)}</span>
                        <span className="font-mono text-xs text-muted-foreground">{r.slackId ?? r.email ?? ""}</span>
                        <span
                          className={`text-xs font-semibold ${
                            r.status === "sent" ? "text-emerald-700" : r.status === "pending" ? "text-carnival-blue" : "text-carnival-red"
                          }`}
                        >
                          {r.status}
                        </span>
                        {r.reason ? <span className="text-xs text-muted-foreground">{reasonLabel(r.reason)}</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}

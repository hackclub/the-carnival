"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  AUDIENCE_FILTERS,
  AUDIENCE_FILTER_KEYS,
  AUDIENCE_PRESETS,
  NUMBER_OPS,
  NUMBER_OP_LABELS,
  VERIFICATION_LABELS,
  VERIFICATION_VALUES,
  defaultFilter,
  describeFilter,
  type AudienceFilter,
  type AudienceFilterKey,
  type NumberOp,
} from "@/lib/notifications/audience-shared";
import {
  OUTREACH_HANDOFF_STORAGE_KEY,
  OUTREACH_MAX_BATCH_SIZE,
  OUTREACH_MAX_MESSAGE_LENGTH,
  OUTREACH_REASON_LABELS,
  RECENT_WINDOWS,
  RECENT_WINDOW_LABELS,
  batchCount,
  buildOutreachFooter,
  mergeRecipients,
  parseSlackIdList,
  renderOutreachMessage,
  type DraftRecipient,
  type OutreachChannel,
  type RecentWindow,
} from "@/lib/notifications/outreach-shared";
import type {
  ExclusionRow,
  OutreachRecipientRow,
  OutreachSendSummary,
  SelfOptOutRow,
} from "@/lib/notifications/outreach";

export type MessagesPageData = {
  users: { id: string; name: string; email: string; slackId: string | null; isFrozen: boolean }[];
  exclusions: { excluded: ExclusionRow[]; selfOptedOut: SelfOptOutRow[] };
  sends: OutreachSendSummary[];
  slackEnabled: boolean;
  emailEnabled: boolean;
  /** For previewing the opt-out footer added to every hand-written message. */
  footer: { appBaseUrl: string; contactSlackId: string | null };
};

type PageUser = MessagesPageData["users"][number];

type ResolvedRecipient = DraftRecipient & { status: "pending" | "skipped"; reason: string | null };

const card = "platform-surface-card p-5";
const fieldClass =
  "bg-background border border-border rounded-[var(--radius-xl)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40";
const inputClass = `w-full px-3 py-2.5 ${fieldClass}`;
/** Inline controls in a filter row. */
const compactClass = `px-2 py-1.5 ${fieldClass}`;
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
        sends={sends}
        exclusionsVersion={exclusionsVersion}
      />
      <ExclusionsPanel initial={initial.exclusions} users={initial.users} usersBySlack={usersBySlack} onChanged={onExclusionsChanged} />
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
  sends,
  exclusionsVersion,
}: {
  initial: MessagesPageData;
  usersById: Map<string, MessagesPageData["users"][number]>;
  usersBySlack: Map<string, MessagesPageData["users"][number]>;
  toDraft: (u: MessagesPageData["users"][number]) => DraftRecipient;
  onSent: () => Promise<void>;
  sends: OutreachSendSummary[];
  exclusionsVersion: number;
}) {
  const [message, setMessage] = useState("Hey {firstName}! 🎪 ");
  const [channel, setChannel] = useState<OutreachChannel>(initial.slackEnabled ? "slack" : "email");
  const [recentWindow, setRecentWindow] = useState<RecentWindow>("today");
  const [batchSizeText, setBatchSizeText] = useState(String(OUTREACH_MAX_BATCH_SIZE));
  const [drafts, setDrafts] = useState<DraftRecipient[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [resolved, setResolved] = useState<ResolvedRecipient[] | null>(null);
  const [resolving, setResolving] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeSend, setActiveSend] = useState<string | null>(null);
  const [polled, setProgress] = useState<OutreachSendSummary | null>(null);
  // While polling, the polled copy is freshest; otherwise follow History, which
  // also sees batches released or cancelled from there.
  const progress = polled && !activeSend ? (sends.find((s) => s.id === polled.id) ?? polled) : polled;

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

  // Re-check recipients (names, exclusions, frozen, recently nudged) whenever the list changes.
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
        recentWindow,
      });
      setResolving(false);
      if (ok && data.recipients) setResolved(data.recipients);
      else if (!ok) toast.error(data.error ?? "Couldn't check recipients.");
    }, 400);
    return () => window.clearTimeout(timer);
  }, [channel, drafts, recentWindow, exclusionsVersion]);

  // Poll the send we just started until its batch finishes.
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
        const c = data.send.counts;
        toast.success(
          data.send.status === "waiting"
            ? `Batch ${data.send.batches.current} done: ${c.sent} sent so far, ${c.queued} waiting for the next batches.`
            : `Finished: ${c.sent} sent, ${c.skipped} skipped, ${c.failed} failed.`,
        );
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

  const addAudience = useCallback(
    (userIds: string[], label: string) => {
      const additions = userIds
        .map((id) => usersById.get(id))
        .filter((u): u is NonNullable<typeof u> => Boolean(u))
        .map(toDraft);
      setDrafts((prev) => mergeRecipients(prev, additions));
      setConfirming(false);
      toast.success(`Added ${additions.length} from ${label}.`);
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
  const draftKey = (d: DraftRecipient) => (d.userId ? `u:${d.userId}` : `s:${d.slackId}`);
  const visibleDrafts = drafts.filter((d) => resolvedByKey.get(draftKey(d))?.status !== "skipped");
  const hiddenDrafts = drafts.filter((d) => resolvedByKey.get(draftKey(d))?.status === "skipped");
  const hiddenReasons = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of resolved ?? []) {
      if (r.status === "skipped") counts.set(r.reason ?? "", (counts.get(r.reason ?? "") ?? 0) + 1);
    }
    return [...counts.entries()].map(([reason, n]) => `${n} ${reasonLabel(reason)}`).join(" · ");
  }, [resolved]);
  const willReceive = resolved ? resolved.filter((r) => r.status === "pending").length : drafts.length;
  const previewRecipient = (resolved ?? []).find((r) => r.status === "pending") ?? drafts[0] ?? { name: "Ada Lovelace" };

  const batchSize = Number(batchSizeText);
  const batchSizeValid = Number.isInteger(batchSize) && batchSize >= 1 && batchSize <= OUTREACH_MAX_BATCH_SIZE;
  const batches = batchSizeValid ? batchCount(willReceive, batchSize) : 0;
  const firstBatch = batchSizeValid ? Math.min(batchSize, willReceive) : 0;

  const send = useCallback(async () => {
    if (drafts.length === 0) return toast.error("Add at least one recipient.");
    if (message.trim().length < 10) return toast.error("Write a message of at least 10 characters.");
    if (!batchSizeValid) return toast.error(`Batch size must be 1 to ${OUTREACH_MAX_BATCH_SIZE}.`);
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
      recentWindow,
      batchSize,
    });
    setSending(false);
    if (!ok || !data.id) {
      toast.error(data.error ?? "Failed to start the send.");
      return;
    }
    toast.success(
      batches > 1
        ? `Batch 1 of ${batches} is sending in the background. Send the next one when you're ready.`
        : "Sending in the background. You can leave this page.",
    );
    setActiveSend(data.id);
    setDrafts([]);
    await onSent();
  }, [batchSize, batchSizeValid, batches, channel, confirming, drafts, message, onSent, recentWindow]);

  const releaseNext = useCallback(
    async (id: string) => {
      const ok = await postSendAction(id, "next_batch");
      if (ok) setActiveSend(id);
      await onSent();
    },
    [onSent],
  );

  const sendLabel =
    batches > 1 ? `batch 1 of ${batches} (${firstBatch} of ${willReceive})` : `to ${willReceive}`;

  return (
    <div className={card}>
      <h2 className="text-lg font-bold text-foreground">Write a message</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick recipients from any mix of the sources below. People on the exclusion list, anyone who turned off
        Carnival messages in their account, frozen accounts and anyone nudged inside the window you pick are left
        out. Messages go out in the background at about one per second.
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <AudienceBuilder onAdd={addAudience} />

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
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              Recipients ({resolved ? willReceive : drafts.length})
              {resolving ? <span className="ml-2 font-normal text-muted-foreground">checking…</span> : null}
            </span>
            {drafts.length ? (
              <button type="button" className="text-xs font-semibold text-muted-foreground hover:text-foreground" onClick={() => setDrafts([])}>
                Clear all
              </button>
            ) : null}
          </div>
          <label className="block text-sm">
            <span className="sr-only">Already nudged</span>
            <select
              className={inputClass}
              value={recentWindow}
              onChange={(e) => {
                setRecentWindow(e.target.value as RecentWindow);
                setConfirming(false);
              }}
            >
              {RECENT_WINDOWS.map((w) => (
                <option key={w} value={w}>
                  {RECENT_WINDOW_LABELS[w]}
                </option>
              ))}
            </select>
          </label>
          <div className="max-h-96 overflow-y-auto rounded-[var(--radius-xl)] border border-border">
            {drafts.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">No recipients yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {visibleDrafts.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-muted-foreground">Everyone added is left out.</li>
                ) : (
                  visibleDrafts.map((d) => (
                    <RecipientRow key={draftKey(d)} draft={d} onRemove={removeDraft} />
                  ))
                )}
              </ul>
            )}
          </div>
          {hiddenDrafts.length ? (
            <div className="rounded-[var(--radius-xl)] border border-dashed border-border px-3 py-2 text-sm">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left text-muted-foreground hover:text-foreground"
                onClick={() => setShowHidden((v) => !v)}
              >
                <span>
                  <span className="font-semibold">{hiddenDrafts.length} left out</span> · {hiddenReasons}
                </span>
                <span className="text-xs font-semibold">{showHidden ? "Hide" : "Show why"}</span>
              </button>
              {showHidden ? (
                <ul className="mt-2 max-h-56 divide-y divide-border overflow-y-auto">
                  {hiddenDrafts.map((d) => (
                    <RecipientRow
                      key={draftKey(d)}
                      draft={d}
                      reason={reasonLabel(resolvedByKey.get(draftKey(d))?.reason ?? null)}
                      onRemove={removeDraft}
                    />
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
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
          <p className="mt-1 text-xs text-muted-foreground">
            An opt-out line pointing at Account settings is added to the end of every message automatically.
          </p>
        </div>
        <div>
          <span className="mb-1 block text-sm font-semibold text-foreground">
            Preview <span className="font-normal text-muted-foreground">for {recipientLabel(previewRecipient as DraftRecipient)}</span>
          </span>
          <pre className="min-h-[10rem] whitespace-pre-wrap rounded-[var(--radius-xl)] border border-border bg-background/60 p-3 font-sans text-sm text-foreground">
            {renderOutreachMessage(message, { name: (previewRecipient as DraftRecipient).name ?? null })}
            {"\n\n"}
            <span className="text-muted-foreground">{buildOutreachFooter({ ...initial.footer, channel })}</span>
          </pre>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="text-sm sm:w-48">
          <span className="mb-1 block font-semibold text-foreground">Channel</span>
          <select
            className={inputClass}
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
        </label>
        <label className="text-sm sm:w-36">
          <span className="mb-1 block font-semibold text-foreground">Batch size</span>
          <input
            className={inputClass}
            type="number"
            min={1}
            max={OUTREACH_MAX_BATCH_SIZE}
            value={batchSizeText}
            onChange={(e) => {
              setBatchSizeText(e.target.value);
              setConfirming(false);
            }}
          />
        </label>
        <p className="text-xs text-muted-foreground sm:flex-1 sm:pb-2.5">
          {!batchSizeValid
            ? `Batch size must be 1 to ${OUTREACH_MAX_BATCH_SIZE}.`
            : batches > 1
              ? `${willReceive} people in ${batches} batches. Batch 1 goes out now; you send each next batch yourself, below or under History.`
              : `Max ${OUTREACH_MAX_BATCH_SIZE} per batch. Larger lists are split and each batch waits for you.`}
        </p>
        <div>
          <button
            type="button"
            className={dangerButton}
            onClick={send}
            disabled={sending || willReceive === 0 || Boolean(activeSend) || !batchSizeValid}
          >
            {sending ? "Starting…" : confirming ? `Really send ${sendLabel}?` : `Send ${sendLabel}`}
          </button>
        </div>
      </div>

      {progress ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius-xl)] border border-border bg-background/60 px-3 py-2 text-sm">
          <span className="font-semibold text-foreground">
            {progress.status === "running"
              ? `Sending${progress.batches.total > 1 ? ` batch ${progress.batches.current} of ${progress.batches.total}` : ""}…`
              : progress.status === "waiting"
                ? `Batch ${progress.batches.current} of ${progress.batches.total} done`
                : `Send ${progress.status}`}
          </span>
          <span className="text-muted-foreground">
            {progress.counts.sent} sent · {progress.counts.pending} pending
            {progress.counts.queued ? ` · ${progress.counts.queued} in later batches` : ""} · {progress.counts.skipped}{" "}
            skipped · {progress.counts.failed} failed
          </span>
          {progress.status === "waiting" ? (
            <BatchActions send={progress} onNext={releaseNext} onChanged={onSent} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RecipientRow({
  draft,
  reason,
  onRemove,
}: {
  draft: DraftRecipient;
  reason?: string;
  onRemove: (d: DraftRecipient) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <span className="min-w-0">
        <span className={`font-semibold ${reason ? "text-muted-foreground" : "text-foreground"}`}>{recipientLabel(draft)}</span>{" "}
        {!draft.userId ? <span className="text-xs text-amber-600">no Carnival account</span> : null}
        {reason ? (
          <span className="ml-1 rounded-full bg-carnival-red/10 px-1.5 py-0.5 text-[11px] font-semibold text-carnival-red">{reason}</span>
        ) : null}
      </span>
      <button type="button" className="text-xs text-muted-foreground hover:text-carnival-red" onClick={() => onRemove(draft)}>
        Remove
      </button>
    </li>
  );
}

async function postSendAction(id: string, action: "next_batch" | "cancel" | "resume"): Promise<boolean> {
  const { ok, data } = await postJson<{ pending?: number; skipped?: number; batch?: number }>(
    `/api/admin/messages/${encodeURIComponent(id)}`,
    { action },
  );
  if (!ok) {
    toast.error(data.error ?? "That didn't work.");
    return false;
  }
  if (action === "next_batch") {
    toast.success(
      `Batch ${data.batch} is sending to ${data.pending}${data.skipped ? ` (${data.skipped} left out since it was planned)` : ""}.`,
    );
  } else if (action === "cancel") {
    toast.success("Remaining batches cancelled.");
  } else {
    toast.success("Resumed. Only people still pending will be messaged.");
  }
  return true;
}

/** "Send batch N" and "Cancel the rest" for a send waiting on its next batch. */
function BatchActions({
  send,
  onNext,
  onChanged,
}: {
  send: OutreachSendSummary;
  onNext: (id: string) => Promise<void>;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const next = send.batches.current + 1;
  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        className="text-xs font-semibold text-carnival-blue hover:underline disabled:opacity-50"
        disabled={busy}
        onClick={async () => {
          if (!window.confirm(`Send batch ${next} of ${send.batches.total} to ${send.batches.nextBatchSize} people now?`)) return;
          setBusy(true);
          await onNext(send.id);
          setBusy(false);
        }}
      >
        Send batch {next} of {send.batches.total} ({send.batches.nextBatchSize})
      </button>
      <button
        type="button"
        className="text-xs font-semibold text-muted-foreground hover:text-carnival-red disabled:opacity-50"
        disabled={busy}
        onClick={async () => {
          if (!window.confirm(`Cancel the remaining ${send.counts.queued} people? They won't get this message.`)) return;
          setBusy(true);
          await postSendAction(send.id, "cancel");
          await onChanged();
          setBusy(false);
        }}
      >
        Cancel the rest
      </button>
    </span>
  );
}

/** Stack predefined filters to find people, then add them to the recipients. */
function AudienceBuilder({ onAdd }: { onAdd: (userIds: string[], label: string) => void }) {
  const [filters, setFilters] = useState<AudienceFilter[]>([]);
  const [presetLabel, setPresetLabel] = useState<string | null>(null);
  const [matches, setMatches] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const { ok, data } = await postJson<{ userIds?: string[] }>("/api/admin/messages/audience", { filters });
      setLoading(false);
      if (ok && data.userIds) {
        setMatches(data.userIds);
        setError(null);
      } else {
        setMatches(null);
        setError(data.error ?? "Couldn't run the filters.");
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [filters]);

  const update = (i: number, f: AudienceFilter) => {
    setFilters((prev) => prev.map((p, j) => (j === i ? f : p)));
    setPresetLabel(null);
  };
  const remove = (i: number) => {
    setFilters((prev) => prev.filter((_, j) => j !== i));
    setPresetLabel(null);
  };

  const label = presetLabel
    ? `"${presetLabel}"`
    : filters.length
      ? filters.map(describeFilter).join(", ")
      : "everyone";

  return (
    <div className="rounded-[var(--radius-xl)] border border-border p-3">
      <span className="block text-sm font-semibold text-foreground">Find people with filters</span>
      <p className="text-xs text-muted-foreground">Everyone matching all the filters. Presets fill them in for you.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {AUDIENCE_PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`${smallButton} px-2.5 py-1.5 text-xs`}
            title={p.description}
            onClick={() => {
              setFilters(p.filters);
              setPresetLabel(p.label);
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <ul className="mt-3 space-y-2">
        {filters.map((f, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
            <select
              className={compactClass}
              value={f.key}
              onChange={(e) => update(i, defaultFilter(e.target.value as AudienceFilterKey))}
            >
              {AUDIENCE_FILTER_KEYS.map((k) => (
                <option key={k} value={k}>
                  {AUDIENCE_FILTERS[k].label}
                </option>
              ))}
            </select>
            <FilterControls filter={f} onChange={(next) => update(i, next)} />
            <button type="button" className="text-xs text-muted-foreground hover:text-carnival-red" onClick={() => remove(i)}>
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          className={compactClass}
          value=""
          onChange={(e) => {
            if (!e.target.value) return;
            setFilters((prev) => [...prev, defaultFilter(e.target.value as AudienceFilterKey)]);
            setPresetLabel(null);
          }}
        >
          <option value="">+ Add a filter…</option>
          {AUDIENCE_FILTER_KEYS.map((k) => (
            <option key={k} value={k}>
              {AUDIENCE_FILTERS[k].label}
            </option>
          ))}
        </select>
        {filters.length ? (
          <button
            type="button"
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            onClick={() => {
              setFilters([]);
              setPresetLabel(null);
            }}
          >
            Clear filters
          </button>
        ) : null}
        <span className="ml-auto text-sm text-muted-foreground">
          {loading ? "Counting…" : error ? <span className="text-carnival-red">{error}</span> : matches ? `${matches.length} match` : ""}
        </span>
        <button
          type="button"
          className={smallButton}
          disabled={!matches || matches.length === 0 || loading}
          onClick={() => matches && onAdd(matches, label)}
        >
          {filters.length ? `Add ${matches?.length ?? 0}` : `Add everyone (${matches?.length ?? 0})`}
        </button>
      </div>
    </div>
  );
}

function FilterControls({ filter, onChange }: { filter: AudienceFilter; onChange: (f: AudienceFilter) => void }) {
  if ("op" in filter && "value" in filter) {
    const def = AUDIENCE_FILTERS[filter.key];
    const hours = def.kind === "number" && def.unit === "hours";
    return (
      <>
        <select className={compactClass} value={filter.op} onChange={(e) => onChange({ ...filter, op: e.target.value as NumberOp })}>
          {NUMBER_OPS.map((op) => (
            <option key={op} value={op}>
              {NUMBER_OP_LABELS[op]}
            </option>
          ))}
        </select>
        <input
          className={`${compactClass} w-20`}
          type="number"
          min={0}
          step={hours ? 0.5 : 1}
          value={filter.value}
          onChange={(e) => onChange({ ...filter, value: e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)) })}
        />
        {hours ? <span className="text-xs text-muted-foreground">hours</span> : null}
      </>
    );
  }
  if ("value" in filter) {
    return (
      <select className={compactClass} value={filter.value ? "yes" : "no"} onChange={(e) => onChange({ ...filter, value: e.target.value === "yes" })}>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    );
  }
  if ("values" in filter) {
    return (
      <span className="flex flex-wrap gap-x-3 gap-y-1">
        {VERIFICATION_VALUES.map((v) => (
          <label key={v} className="flex items-center gap-1 text-xs text-foreground">
            <input
              type="checkbox"
              className="h-3.5 w-3.5"
              checked={filter.values.includes(v)}
              onChange={(e) => {
                const values = e.target.checked ? [...filter.values, v] : filter.values.filter((x) => x !== v);
                if (values.length) onChange({ ...filter, values });
              }}
            />
            {VERIFICATION_LABELS[v]}
          </label>
        ))}
      </span>
    );
  }
  return (
    <>
      <select className={compactClass} value={filter.op} onChange={(e) => onChange({ ...filter, op: e.target.value as "before" | "after" })}>
        <option value="before">before</option>
        <option value="after">on or after</option>
      </select>
      <input
        className={compactClass}
        type="date"
        value={filter.date}
        onChange={(e) => e.target.value && onChange({ ...filter, date: e.target.value })}
      />
      <span className="text-xs text-muted-foreground">UTC</span>
    </>
  );
}

// ---------------------------------------------------------------------------
// 3. Exclusion list
// ---------------------------------------------------------------------------

function ExclusionsPanel({
  initial,
  users,
  usersBySlack,
  onChanged,
}: {
  initial: MessagesPageData["exclusions"];
  users: MessagesPageData["users"];
  usersBySlack: Map<string, PageUser>;
  onChanged: () => void;
}) {
  const [data, setData] = useState(initial);
  const [ids, setIds] = useState("");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<PageUser[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const preview = useMemo(() => parseSlackIdList(ids), [ids]);
  const excludedSlackIds = useMemo(() => new Set(data.excluded.map((x) => x.slackId)), [data.excluded]);

  // Name, email, Slack ID or Carnival user ID; people already picked or on the list are left out.
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const pickedIds = new Set(picked.map((u) => u.id));
    return users
      .filter(
        (u) =>
          !pickedIds.has(u.id) &&
          !(u.slackId && excludedSlackIds.has(u.slackId)) &&
          (u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            (u.slackId ?? "").toLowerCase().includes(q) ||
            (q.length >= 6 && u.id.toLowerCase().includes(q))),
      )
      .slice(0, 8);
  }, [excludedSlackIds, picked, search, users]);

  const pick = useCallback((u: PageUser) => {
    setPicked((prev) => (prev.some((p) => p.id === u.id) ? prev : [...prev, u]));
    setSearch("");
  }, []);

  const pendingCount = picked.length + preview.ids.length;

  const add = useCallback(async () => {
    if (preview.ids.length === 0 && picked.length === 0) {
      toast.error(
        preview.invalid.length ? `Not Slack user IDs: ${preview.invalid.slice(0, 5).join(", ")}` : "Pick a person or enter a Slack ID.",
      );
      return;
    }
    setBusy(true);
    const { ok, data: res } = await postJson<
      MessagesPageData["exclusions"] & { added?: string[]; alreadyExcluded?: string[] }
    >("/api/admin/messages/exclusions", {
      slackIds: preview.ids,
      userIds: picked.map((u) => u.id),
      note: note.trim() || undefined,
    });
    setBusy(false);
    if (!ok) {
      toast.error(res.error ?? "Failed to update the exclusion list.");
      return;
    }
    setData({ excluded: res.excluded, selfOptedOut: res.selfOptedOut });
    onChanged();
    setIds("");
    setPicked([]);
    setNote("");
    toast.success(
      `Excluded ${res.added?.length ?? 0}${res.alreadyExcluded?.length ? ` · ${res.alreadyExcluded.length} already on the list` : ""}.`,
    );
  }, [note, onChanged, picked, preview]);

  const remove = useCallback(async (slackId: string) => {
    if (!window.confirm(`Remove ${slackId} from the exclusion list? They can receive messages again.`)) return;
    const res = await fetch(`/api/admin/messages/exclusions?slackId=${encodeURIComponent(slackId)}`, { method: "DELETE" });
    const body = (await res.json().catch(() => ({}))) as MessagesPageData["exclusions"] & { error?: string };
    if (!res.ok) {
      toast.error(body.error ?? "Failed to remove.");
      return;
    }
    setData({ excluded: body.excluded, selfOptedOut: body.selfOptedOut });
    onChanged();
    toast.success(`${slackId} can receive messages again.`);
  }, [onChanged]);

  return (
    <div className={card}>
      <h2 className="text-lg font-bold text-foreground">Excluded people</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        People here never hear from the Carnival bot: not the automated reminders, not &quot;run now&quot;, and not
        messages written on this page. Add anyone who asks you to stop. Pick them by name or paste Slack IDs; the
        list is keyed by Slack ID, so it also covers people without a Carnival account.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="text-sm">
          <label className="mb-1 block font-semibold text-foreground" htmlFor="exclude-search">
            Find a person
          </label>
          <input
            id="exclude-search"
            className={inputClass}
            placeholder="Search by name, email, Slack ID or user ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {matches.length > 0 ? (
            <ul className="mt-2 divide-y divide-border rounded-[var(--radius-xl)] border border-border">
              {matches.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-background/60 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => pick(u)}
                    disabled={!u.slackId}
                    title={u.slackId ? undefined : "No Slack ID on file, so the bot can't message them anyway"}
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
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-foreground">Or paste Slack IDs</span>
          <input className={inputClass} placeholder="U0123ABCD, <@U0456EFGH>" value={ids} onChange={(e) => setIds(e.target.value)} />
        </label>
      </div>
      {pendingCount ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-foreground">To exclude:</span>
          {picked.map((u) => (
            <button
              key={u.id}
              type="button"
              className="rounded-full border border-border bg-background/60 px-2.5 py-1 text-foreground hover:border-carnival-red hover:text-carnival-red"
              onClick={() => setPicked((prev) => prev.filter((p) => p.id !== u.id))}
              title="Remove from this list"
            >
              {u.name} · {u.slackId} ×
            </button>
          ))}
          {preview.ids.map((id) => {
            const u = usersBySlack.get(id);
            return (
              <span key={id} className="rounded-full border border-dashed border-border px-2.5 py-1 text-muted-foreground">
                {u ? `${u.name} · ${id}` : `${id} · no Carnival account`}
              </span>
            );
          })}
        </div>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-foreground">Note (optional)</span>
          <input className={inputClass} placeholder="Asked to stop on Oct 20" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button type="button" className={smallButton} onClick={add} disabled={busy}>
          {busy ? "Adding…" : pendingCount ? `Exclude ${pendingCount}` : "Exclude"}
        </button>
      </div>

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
            These people turned off Carnival messages on their Account page, so they are left out of the automated
            reminders and of messages written here. Review, grant and shop updates still reach them. They can turn
            messages back on themselves; the list above is yours alone.
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
    if (await postSendAction(id, "resume")) await onRefresh();
  }, [onRefresh]);
  const releaseNext = useCallback(async (id: string) => {
    await postSendAction(id, "next_batch");
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
                <HistoryRow
                  key={s.id}
                  send={s}
                  open={openId === s.id}
                  detail={openId === s.id ? detail : null}
                  onToggle={open}
                  onResume={resume}
                  onNext={releaseNext}
                  onChanged={onRefresh}
                />
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
  onNext,
  onChanged,
}: {
  send: OutreachSendSummary;
  open: boolean;
  detail: { send: OutreachSendSummary & { message: string | null }; recipients: OutreachRecipientRow[] } | null;
  onToggle: (id: string) => void;
  onResume: (id: string) => void;
  onNext: (id: string) => Promise<void>;
  onChanged: () => Promise<void>;
}) {
  const multiBatch = send.kind === "custom" && send.batches.total > 1;
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
          {multiBatch ? (
            <div className="text-xs text-muted-foreground">
              Batches of {send.batches.size} · {Math.min(send.batches.current, send.batches.total)} of {send.batches.total} released
              {send.counts.queued ? ` · ${send.counts.queued} waiting` : ""}
            </div>
          ) : null}
          {send.status === "waiting" ? (
            <div className="mt-1">
              <BatchActions send={send} onNext={onNext} onChanged={onChanged} />
            </div>
          ) : null}
          {summaryError ? <div className="text-xs text-carnival-red">{summaryError}</div> : null}
        </td>
        <td className="px-3 py-2 whitespace-nowrap">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              send.status === "completed"
                ? "bg-emerald-500/10 text-emerald-700"
                : send.status === "running"
                  ? "bg-carnival-blue/10 text-carnival-blue"
                  : send.status === "waiting" || send.status === "cancelled"
                    ? "bg-amber-500/10 text-amber-700"
                    : "bg-carnival-red/10 text-carnival-red"
            }`}
          >
            {send.status === "waiting" ? "waiting for next batch" : send.status}
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
                        {multiBatch && r.status !== "skipped" ? (
                          <span className="text-xs text-muted-foreground">batch {r.batch}</span>
                        ) : null}
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

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

export type UserListItem = {
  id: string;
  name: string | null;
  email: string;
  slackId: string | null;
  verificationStatus: string | null;
  hackatimeUserId: string | null;
  role: "user" | "reviewer" | "admin";
  isFrozen: boolean;
  frozenReason: string | null;
  frozenAt: string | null;
};

export type InternalProfileStats = {
  totalInternalUsers: number;
  withSlackId: number;
  withVerificationStatus: number;
  withHackatimeConnected: number;
  frozenInternalUsers: number;
};

type AdminLedgerRow = {
  id: string;
  kind: "issue" | "deduct";
  tokens: number;
  reason: string;
  byUserId: string | null;
  createdAt: string;
};

type AdminLedgerResponse = {
  user: {
    id: string;
    name: string | null;
    email: string;
    role: "user" | "reviewer" | "admin";
    isFrozen: boolean;
    frozenReason: string | null;
    frozenAt: string | null;
  };
  balance: number;
  ledger: AdminLedgerRow[];
  error?: string;
};

const roleOptions: { value: UserListItem["role"]; label: string }[] = [
  { value: "user", label: "User" },
  { value: "reviewer", label: "Reviewer" },
  { value: "admin", label: "Admin" },
];

const LEDGER_CONFIRMATION_PHRASE = "CONFIRM_LEDGER_ADJUSTMENT";

function toPercent(part: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export default function AdminUsersClient({
  initial,
  currentUserId,
}: {
  initial: UserListItem[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState<UserListItem[]>(initial);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [activeLedgerUserId, setActiveLedgerUserId] = useState<string | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [ledgerData, setLedgerData] = useState<AdminLedgerResponse | null>(null);

  const [adjustmentType, setAdjustmentType] = useState<"issue" | "deduct">("issue");
  const [adjustmentAmount, setAdjustmentAmount] = useState("1");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjustmentConfirmation, setAdjustmentConfirmation] = useState("");
  const [submittingAdjustment, setSubmittingAdjustment] = useState(false);

  const sortedUsers = useMemo(() => users, [users]);
  const totalUserCount = users.length;
  const internalStats = useMemo<InternalProfileStats>(() => {
    const internalUsers = users.filter((u) => u.role === "reviewer" || u.role === "admin");
    return {
      totalInternalUsers: internalUsers.length,
      withSlackId: internalUsers.filter((u) => !!u.slackId?.trim()).length,
      withVerificationStatus: internalUsers.filter((u) => !!u.verificationStatus?.trim()).length,
      withHackatimeConnected: internalUsers.filter((u) => !!u.hackatimeUserId?.trim()).length,
      frozenInternalUsers: internalUsers.filter((u) => !!u.isFrozen).length,
    };
  }, [users]);

  const updateRole = useCallback(
    async (userId: string, newRole: UserListItem["role"]) => {
      if (userId === currentUserId) {
        toast.error("You cannot change your own role.");
        return;
      }

      setUpdatingId(userId);
      const toastId = toast.loading("Updating role…");

      try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        });

        const data = (await res.json().catch(() => null)) as {
          error?: string;
          user?: { id: string; role: UserListItem["role"] };
        } | null;

        if (!res.ok) {
          toast.error(data?.error || "Failed to update role.", { id: toastId });
          setUpdatingId(null);
          return;
        }

        toast.success("Role updated.", { id: toastId });
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
        setUpdatingId(null);
      } catch {
        toast.error("Failed to update role.", { id: toastId });
        setUpdatingId(null);
      }
    },
    [currentUserId],
  );

  const updateFreezeState = useCallback(
    async (userId: string, freeze: boolean) => {
      if (userId === currentUserId) {
        toast.error("You cannot change your own freeze state.");
        return;
      }

      const reasonPrompt = freeze
        ? "Reason for freezing this account:"
        : "Reason for unfreezing this account:";
      const reason = window.prompt(reasonPrompt)?.trim() ?? "";
      if (!reason) {
        toast.error("A reason is required.");
        return;
      }

      const proceed = window.confirm(
        freeze
          ? "Confirm freezing this account?"
          : "Confirm unfreezing this account?",
      );
      if (!proceed) return;

      setUpdatingId(userId);
      const toastId = toast.loading(freeze ? "Freezing account…" : "Unfreezing account…");

      try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ freeze, reason }),
        });

        const data = (await res.json().catch(() => null)) as {
          error?: string;
          user?: {
            id: string;
            isFrozen: boolean;
            frozenReason: string | null;
            frozenAt: string | null;
          };
        } | null;

        if (!res.ok) {
          toast.error(data?.error || "Failed to update freeze state.", { id: toastId });
          setUpdatingId(null);
          return;
        }

        toast.success(freeze ? "Account frozen." : "Account unfrozen.", { id: toastId });
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId
              ? {
                  ...u,
                  isFrozen: freeze,
                  frozenReason: freeze ? reason : null,
                  frozenAt: freeze
                    ? (data?.user?.frozenAt ?? new Date().toISOString())
                    : null,
                }
              : u,
          ),
        );

        if (activeLedgerUserId === userId) {
          setLedgerData((prev) =>
            prev
              ? {
                  ...prev,
                  user: {
                    ...prev.user,
                    isFrozen: freeze,
                    frozenReason: freeze ? reason : null,
                    frozenAt: freeze
                      ? (data?.user?.frozenAt ?? new Date().toISOString())
                      : null,
                  },
                }
              : prev,
          );
        }

        setUpdatingId(null);
      } catch {
        toast.error("Failed to update freeze state.", { id: toastId });
        setUpdatingId(null);
      }
    },
    [activeLedgerUserId, currentUserId],
  );

  const loadLedger = useCallback(async (userId: string) => {
    setActiveLedgerUserId(userId);
    setLedgerLoading(true);
    setLedgerError(null);

    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/ledger?limit=50`, {
        method: "GET",
        cache: "no-store",
      });

      const data = (await res.json().catch(() => null)) as AdminLedgerResponse | null;
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load ledger");
      }

      setLedgerData(data);
    } catch (err: unknown) {
      setLedgerData(null);
      setLedgerError(err instanceof Error ? err.message : "Failed to load ledger");
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  const submitAdjustment = useCallback(async () => {
    if (!activeLedgerUserId) return;

    const amount = Number(adjustmentAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
      toast.error("Amount must be a positive integer.");
      return;
    }

    if (!adjustmentReason.trim()) {
      toast.error("Reason is required.");
      return;
    }

    if (adjustmentConfirmation.trim() !== LEDGER_CONFIRMATION_PHRASE) {
      toast.error(`Type ${LEDGER_CONFIRMATION_PHRASE} to confirm.`);
      return;
    }

    setSubmittingAdjustment(true);
    const toastId = toast.loading("Applying ledger adjustment…");

    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(activeLedgerUserId)}/ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: adjustmentType,
          amount,
          reason: adjustmentReason.trim(),
          confirmation: adjustmentConfirmation.trim(),
        }),
      });

      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        toast.error(data?.error || "Failed to apply adjustment.", { id: toastId });
        setSubmittingAdjustment(false);
        return;
      }

      toast.success("Ledger adjustment recorded.", { id: toastId });
      setAdjustmentReason("");
      setAdjustmentConfirmation("");
      await loadLedger(activeLedgerUserId);
      setSubmittingAdjustment(false);
    } catch {
      toast.error("Failed to apply adjustment.", { id: toastId });
      setSubmittingAdjustment(false);
    }
  }, [
    activeLedgerUserId,
    adjustmentAmount,
    adjustmentConfirmation,
    adjustmentReason,
    adjustmentType,
    loadLedger,
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="platform-surface-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total users</div>
          <div className="mt-1 text-2xl font-bold text-foreground">{totalUserCount}</div>
        </div>
        <div className="platform-surface-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Internal profiles</div>
          <div className="mt-1 text-2xl font-bold text-foreground">{internalStats.totalInternalUsers}</div>
          <div className="text-xs text-muted-foreground">reviewer/admin</div>
        </div>
        <div className="platform-surface-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Internal Slack linked</div>
          <div className="mt-1 text-xl font-bold text-foreground">
            {internalStats.withSlackId} ({toPercent(internalStats.withSlackId, internalStats.totalInternalUsers)})
          </div>
        </div>
        <div className="platform-surface-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Internal verified</div>
          <div className="mt-1 text-xl font-bold text-foreground">
            {internalStats.withVerificationStatus} ({toPercent(internalStats.withVerificationStatus, internalStats.totalInternalUsers)})
          </div>
        </div>
        <div className="platform-surface-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Internal frozen</div>
          <div className="mt-1 text-xl font-bold text-foreground">{internalStats.frozenInternalUsers}</div>
          <div className="text-xs text-muted-foreground">
            Hackatime linked: {internalStats.withHackatimeConnected}
          </div>
        </div>
      </div>

      <div className="platform-surface-card overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
          <div className="col-span-2">Name</div>
          <div className="col-span-2">Email</div>
          <div className="col-span-1">Slack</div>
          <div className="col-span-2">Verification</div>
          <div className="col-span-1">Role</div>
          <div className="col-span-2">Frozen</div>
          <div className="col-span-2">Actions</div>
        </div>
        <div className="divide-y divide-border">
          {sortedUsers.map((u) => {
            const isCurrentUser = u.id === currentUserId;
            const isUpdating = updatingId === u.id;

            return (
              <div key={u.id} className="grid grid-cols-12 gap-3 px-5 py-4 items-center">
                <div className="col-span-2 text-foreground font-semibold truncate">
                  {u.name}
                  {isCurrentUser && (
                    <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                  )}
                </div>
                <div className="col-span-2 text-muted-foreground font-mono text-sm truncate">
                  {u.email}
                </div>
                <div className="col-span-1 text-muted-foreground font-mono text-sm truncate">
                  {u.slackId || "—"}
                </div>
                <div className="col-span-2 text-muted-foreground font-mono text-sm truncate">
                  {u.verificationStatus || "—"}
                </div>
                <div className="col-span-1">
                  <Select
                    value={u.role}
                    onValueChange={(v) => { if (v) updateRole(u.id, v as UserListItem["role"]); }}
                    disabled={isCurrentUser || isUpdating}
                  >
                    <SelectTrigger className={`w-full h-9 rounded-lg border-border bg-background px-2 text-sm text-foreground font-medium ${isUpdating ? "animate-pulse" : ""}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 text-sm">
                  {u.isFrozen ? (
                    <div className="text-red-600 font-semibold">Frozen</div>
                  ) : (
                    <div className="text-emerald-600 font-semibold">Active</div>
                  )}
                  {u.frozenReason ? (
                    <div className="text-xs text-muted-foreground truncate" title={u.frozenReason}>
                      {u.frozenReason}
                    </div>
                  ) : null}
                </div>
                <div className="col-span-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => updateFreezeState(u.id, !u.isFrozen)}
                    disabled={isCurrentUser || isUpdating}
                    className="rounded-[var(--radius-xl)] border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {u.isFrozen ? "Unfreeze" : "Freeze"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (activeLedgerUserId === u.id) {
                        setActiveLedgerUserId(null);
                        setLedgerData(null);
                        setLedgerError(null);
                        return;
                      }
                      void loadLedger(u.id);
                    }}
                    className="rounded-[var(--radius-xl)] border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
                  >
                    {activeLedgerUserId === u.id ? "Hide ledger" : "Ledger"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {activeLedgerUserId ? (
        <div className="platform-surface-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-foreground text-lg font-semibold">Ledger inspection</div>
              <div className="text-muted-foreground text-sm">
                {ledgerData?.user.name || "User"} ({ledgerData?.user.email || activeLedgerUserId})
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadLedger(activeLedgerUserId)}
              className="rounded-[var(--radius-xl)] border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
            >
              Refresh
            </button>
          </div>

          {ledgerLoading ? (
            <div className="text-muted-foreground">Loading ledger…</div>
          ) : ledgerError ? (
            <div className="text-red-600 text-sm">{ledgerError}</div>
          ) : ledgerData ? (
            <>
              <div className="rounded-[var(--radius-xl)]  border-2 border-[var(--carnival-border)] bg-background px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Current balance</div>
                <div className="text-2xl font-bold text-foreground mt-1">{ledgerData.balance} tokens</div>
              </div>

              <div className="rounded-[var(--radius-xl)]  border-2 border-[var(--carnival-border)] bg-background p-4 space-y-3">
                <div className="text-sm font-semibold text-foreground">Guarded adjustment</div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Type
                    <Select value={adjustmentType} onValueChange={(v) => { if (v) setAdjustmentType(v as "issue" | "deduct"); }}>
                      <SelectTrigger className="w-full h-9 rounded-lg border-border bg-card px-3 text-sm text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="issue">Issue</SelectItem>
                        <SelectItem value="deduct">Deduct</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Amount
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={adjustmentAmount}
                      onChange={(e) => setAdjustmentAmount(e.target.value)}
                      className="carnival-control px-3 py-2 text-sm text-foreground"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground md:col-span-2">
                    Reason
                    <input
                      value={adjustmentReason}
                      onChange={(e) => setAdjustmentReason(e.target.value)}
                      placeholder="Required reason for audit trail"
                      className="carnival-control px-3 py-2 text-sm text-foreground"
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Confirmation (type {LEDGER_CONFIRMATION_PHRASE})
                  <input
                    value={adjustmentConfirmation}
                    onChange={(e) => setAdjustmentConfirmation(e.target.value)}
                    className="carnival-control px-3 py-2 text-sm text-foreground"
                  />
                </label>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void submitAdjustment()}
                    disabled={submittingAdjustment}
                    className="rounded-[var(--radius-xl)] bg-carnival-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submittingAdjustment ? "Applying…" : "Apply adjustment"}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold text-foreground">Recent entries</div>
                {ledgerData.ledger.length === 0 ? (
                  <div className="text-muted-foreground text-sm">No ledger entries.</div>
                ) : (
                  <div className="space-y-2">
                    {ledgerData.ledger.map((row) => (
                      <div
                        key={row.id}
                        className="rounded-[var(--radius-xl)]  border-2 border-[var(--carnival-border)] bg-background px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-foreground">
                            {row.kind === "issue" ? "+" : "-"}
                            {row.tokens} tokens
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(row.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">{row.reason}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          by: {row.byUserId || "system"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

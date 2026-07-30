"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type WalletUserOption = {
  id: string;
  name: string | null;
  email: string;
  role: "user" | "reviewer" | "admin";
};

type LedgerUserRef = {
  id: string;
  name?: string | null;
  email?: string;
  role?: "user" | "reviewer" | "admin";
};

type WalletLedgerRow = {
  id: string;
  kind: "issue" | "deduct";
  tokens: number;
  reason: string;
  byUserId: string | null;
  createdAt: string;
};

type WalletResponse = {
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
  ledger: WalletLedgerRow[];
  error?: string;
};

type AuditEntry = {
  id: string;
  kind: "issue" | "deduct";
  tokens: number;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
  issuedTo: LedgerUserRef;
  by: LedgerUserRef | null;
};

type AuditTotals = {
  issued: number;
  deducted: number;
  net: number;
  entryCount: number;
};

type AuditResponse = {
  entries?: AuditEntry[];
  totals?: AuditTotals;
  error?: string;
};

type AuditFilterState = {
  userId: string;
  kind: string;
  referenceType: string;
  from: string;
  to: string;
  limit: string;
};

const LEDGER_CONFIRMATION_PHRASE = "CONFIRM_LEDGER_ADJUSTMENT";

const EMPTY_AUDIT_FILTERS: AuditFilterState = {
  userId: "",
  kind: "all",
  referenceType: "",
  from: "",
  to: "",
  limit: "100",
};

function buildAuditQuery(filters: AuditFilterState): string {
  const params = new URLSearchParams();
  if (filters.userId.trim()) params.set("userId", filters.userId.trim());
  if (filters.kind === "issue" || filters.kind === "deduct") params.set("kind", filters.kind);
  if (filters.referenceType.trim()) params.set("referenceType", filters.referenceType.trim());
  if (filters.from.trim()) params.set("from", filters.from.trim());
  if (filters.to.trim()) params.set("to", filters.to.trim());
  if (filters.limit.trim()) params.set("limit", filters.limit.trim());
  const query = params.toString();
  return query ? `?${query}` : "";
}

function displayUser(ref: LedgerUserRef | null): string {
  if (!ref) return "system";
  if (ref.name && ref.email) return `${ref.name} (${ref.email})`;
  if (ref.email) return ref.email;
  if (ref.name) return ref.name;
  return ref.id;
}

export default function AdminWalletClient({ users }: { users: WalletUserOption[] }) {
  const [userQuery, setUserQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletData, setWalletData] = useState<WalletResponse | null>(null);

  const [adjustmentType, setAdjustmentType] = useState<"issue" | "deduct">("issue");
  const [adjustmentAmount, setAdjustmentAmount] = useState("1");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjustmentConfirmation, setAdjustmentConfirmation] = useState("");
  const [submittingAdjustment, setSubmittingAdjustment] = useState(false);

  const [formFilters, setFormFilters] = useState<AuditFilterState>(EMPTY_AUDIT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<AuditFilterState>(EMPTY_AUDIT_FILTERS);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditTotals, setAuditTotals] = useState<AuditTotals | null>(null);
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);

  const matchedUsers = useMemo(() => {
    const q = userQuery.toLowerCase().trim();
    if (!q) return [];
    return users
      .filter(
        (u) =>
          (u.name ?? "").toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [users, userQuery]);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) ?? null,
    [users, selectedUserId],
  );

  const loadWallet = useCallback(async (userId: string) => {
    setWalletLoading(true);
    setWalletError(null);

    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/ledger?limit=50`, {
        method: "GET",
        cache: "no-store",
      });

      const data = (await res.json().catch(() => null)) as WalletResponse | null;
      if (!res.ok || !data) {
        throw new Error(data?.error || "Failed to load wallet");
      }

      setWalletData(data);
    } catch (err: unknown) {
      setWalletData(null);
      setWalletError(err instanceof Error ? err.message : "Failed to load wallet");
    } finally {
      setWalletLoading(false);
    }
  }, []);

  const selectUser = useCallback(
    (userId: string) => {
      setSelectedUserId(userId);
      setUserQuery("");
      void loadWallet(userId);
    },
    [loadWallet],
  );

  const submitAdjustment = useCallback(async () => {
    if (!selectedUserId) return;

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
    const toastId = toast.loading(
      adjustmentType === "issue" ? "Adding tokens…" : "Withdrawing tokens…",
    );

    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(selectedUserId)}/ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: adjustmentType,
          amount,
          reason: adjustmentReason.trim(),
          confirmation: adjustmentConfirmation.trim(),
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        error?: string;
        balanceAfter?: number;
      } | null;
      if (!res.ok) {
        toast.error(data?.error || "Failed to apply adjustment.", { id: toastId });
        setSubmittingAdjustment(false);
        return;
      }

      toast.success(
        typeof data?.balanceAfter === "number"
          ? `Adjustment recorded. New balance: ${data.balanceAfter} tokens.`
          : "Adjustment recorded.",
        { id: toastId },
      );
      setAdjustmentReason("");
      setAdjustmentConfirmation("");
      setSubmittingAdjustment(false);
      setAuditRefreshKey((prev) => prev + 1);
      await loadWallet(selectedUserId);
    } catch {
      toast.error("Failed to apply adjustment.", { id: toastId });
      setSubmittingAdjustment(false);
    }
  }, [
    adjustmentAmount,
    adjustmentConfirmation,
    adjustmentReason,
    adjustmentType,
    loadWallet,
    selectedUserId,
  ]);

  const auditQuery = useMemo(() => buildAuditQuery(appliedFilters), [appliedFilters]);

  useEffect(() => {
    let cancelled = false;
    setAuditLoading(true);
    setAuditError(null);

    fetch(`/api/admin/ledger${auditQuery}`, { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as AuditResponse | null;
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load ledger");
        }

        if (cancelled) return;
        setAuditEntries(Array.isArray(data?.entries) ? data.entries : []);
        setAuditTotals(data?.totals ?? null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setAuditError(err instanceof Error ? err.message : "Failed to load ledger");
        setAuditEntries([]);
        setAuditTotals(null);
      })
      .finally(() => {
        if (!cancelled) setAuditLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [auditQuery, auditRefreshKey]);

  return (
    <div className="space-y-6">
      <div className="platform-surface-card p-5 space-y-4">
        <div>
          <div className="text-foreground font-semibold text-lg">User wallet</div>
          <div className="text-sm text-muted-foreground">
            Look up a user&apos;s token balance and manually add or withdraw tokens. Every
            adjustment requires a reason and is recorded in the ledger and audit log.
          </div>
        </div>

        <div className="relative">
          <input
            type="text"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="Search users by name or email…"
            className="w-full bg-background border border-border rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
          />
          {matchedUsers.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-[var(--radius-xl)] border border-border bg-card shadow-lg">
              {matchedUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => selectUser(u.id)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-foreground">
                      {u.name || "Unnamed"}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                  </span>
                  <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
                    {u.role}
                  </span>
                </button>
              ))}
            </div>
          )}
          {userQuery.trim() && matchedUsers.length === 0 && (
            <div className="mt-2 text-xs text-muted-foreground">No users match.</div>
          )}
        </div>

        {selectedUserId ? (
          walletLoading ? (
            <div className="text-muted-foreground">Loading wallet…</div>
          ) : walletError ? (
            <div className="text-sm text-red-600">{walletError}</div>
          ) : walletData ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-foreground font-semibold">
                    {walletData.user.name || "Unnamed"}
                    {walletData.user.isFrozen ? (
                      <span className="ml-2 text-xs font-semibold text-red-600">Frozen</span>
                    ) : null}
                  </div>
                  <div className="text-sm text-muted-foreground">{walletData.user.email}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void loadWallet(selectedUserId)}
                  className="rounded-[var(--radius-xl)] border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  Refresh
                </button>
              </div>

              <div className="rounded-[var(--radius-xl)] border border-border bg-background px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Current balance
                </div>
                <div className="mt-1 text-2xl font-bold text-foreground">
                  {walletData.balance} tokens
                </div>
              </div>

              <div className="rounded-[var(--radius-xl)] border border-border bg-background p-4 space-y-3">
                <div className="text-sm font-semibold text-foreground">Guarded adjustment</div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Type
                    <Select
                      value={adjustmentType}
                      onValueChange={(v) => { if (v) setAdjustmentType(v as "issue" | "deduct"); }}
                    >
                      <SelectTrigger className="w-full h-9 rounded-lg border-border bg-card px-3 text-sm text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="issue">Add tokens</SelectItem>
                        <SelectItem value="deduct">Withdraw tokens</SelectItem>
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
                    {submittingAdjustment
                      ? "Applying…"
                      : adjustmentType === "issue"
                        ? "Add tokens"
                        : "Withdraw tokens"}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold text-foreground">Recent entries</div>
                {walletData.ledger.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No ledger entries.</div>
                ) : (
                  <div className="space-y-2">
                    {walletData.ledger.map((row) => (
                      <div
                        key={row.id}
                        className="rounded-[var(--radius-xl)] border border-border bg-background px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div
                            className={`text-sm font-semibold ${row.kind === "issue" ? "text-emerald-600" : "text-red-600"}`}
                          >
                            {row.kind === "issue" ? "+" : "-"}
                            {row.tokens} tokens
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(row.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">{row.reason}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          by: {row.byUserId || "system"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null
        ) : (
          <div className="text-sm text-muted-foreground">
            Search for a user above to view their balance and adjust their wallet.
          </div>
        )}
      </div>

      <div className="platform-surface-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-foreground font-semibold text-lg">Ledger audit</div>
            <div className="text-sm text-muted-foreground">
              Every token movement on the platform — grants, shop orders, and manual adjustments.
            </div>
          </div>
          {selectedUser ? (
            <button
              type="button"
              onClick={() => {
                const next = { ...EMPTY_AUDIT_FILTERS, userId: selectedUser.id };
                setFormFilters(next);
                setAppliedFilters(next);
              }}
              className="rounded-[var(--radius-xl)] border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
            >
              Filter to {selectedUser.name || selectedUser.email}
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-xs text-muted-foreground flex flex-col gap-1">
            User ID
            <input
              value={formFilters.userId}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, userId: e.target.value }))}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted-foreground flex flex-col gap-1">
            Kind
            <Select
              value={formFilters.kind}
              onValueChange={(v) => { if (v) setFormFilters((prev) => ({ ...prev, kind: v })); }}
            >
              <SelectTrigger className="w-full h-9 rounded-lg border-border bg-background px-3 text-sm text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="issue">Issue</SelectItem>
                <SelectItem value="deduct">Deduct</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="text-xs text-muted-foreground flex flex-col gap-1">
            Reference type
            <input
              value={formFilters.referenceType}
              onChange={(e) =>
                setFormFilters((prev) => ({ ...prev, referenceType: e.target.value }))
              }
              placeholder="admin_adjustment"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted-foreground flex flex-col gap-1">
            From (ISO date/time)
            <input
              value={formFilters.from}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, from: e.target.value }))}
              placeholder="2026-07-01T00:00:00Z"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted-foreground flex flex-col gap-1">
            To (ISO date/time)
            <input
              value={formFilters.to}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, to: e.target.value }))}
              placeholder="2026-07-31T23:59:59Z"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted-foreground flex flex-col gap-1">
            Limit
            <input
              type="number"
              min={1}
              max={500}
              value={formFilters.limit}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, limit: e.target.value }))}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setFormFilters(EMPTY_AUDIT_FILTERS);
              setAppliedFilters(EMPTY_AUDIT_FILTERS);
            }}
            className="rounded-[var(--radius-xl)] border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Reset filters
          </button>
          <button
            type="button"
            onClick={() => setAppliedFilters(formFilters)}
            className="rounded-[var(--radius-xl)] bg-carnival-red px-4 py-2 text-sm font-semibold text-white"
          >
            Apply filters
          </button>
        </div>

        {auditTotals ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-[var(--radius-xl)] border border-border bg-background px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Issued</div>
              <div className="mt-1 text-xl font-bold text-emerald-600">
                +{auditTotals.issued.toLocaleString()}
              </div>
            </div>
            <div className="rounded-[var(--radius-xl)] border border-border bg-background px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Deducted</div>
              <div className="mt-1 text-xl font-bold text-red-600">
                -{auditTotals.deducted.toLocaleString()}
              </div>
            </div>
            <div className="rounded-[var(--radius-xl)] border border-border bg-background px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Net</div>
              <div className="mt-1 text-xl font-bold text-foreground">
                {auditTotals.net.toLocaleString()}
              </div>
            </div>
            <div className="rounded-[var(--radius-xl)] border border-border bg-background px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Entries</div>
              <div className="mt-1 text-xl font-bold text-foreground">
                {auditTotals.entryCount.toLocaleString()}
              </div>
            </div>
          </div>
        ) : null}

        {auditLoading ? (
          <div className="text-muted-foreground">Loading ledger…</div>
        ) : auditError ? (
          <div className="text-sm text-red-600">{auditError}</div>
        ) : auditEntries.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No ledger entries matched your filters.
          </div>
        ) : (
          <div className="space-y-2">
            {auditEntries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-[var(--radius-xl)] border border-border bg-background px-4 py-3 space-y-1"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div
                    className={`text-sm font-semibold ${entry.kind === "issue" ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {entry.kind === "issue" ? "+" : "-"}
                    {entry.tokens} tokens
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">{entry.reason}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-xs text-muted-foreground">
                  <div>
                    Wallet:{" "}
                    <button
                      type="button"
                      onClick={() => selectUser(entry.issuedTo.id)}
                      className="font-semibold text-foreground underline-offset-2 hover:underline"
                    >
                      {displayUser(entry.issuedTo)}
                    </button>
                  </div>
                  <div>
                    By: <span className="text-foreground">{displayUser(entry.by)}</span>
                  </div>
                </div>
                {entry.referenceType ? (
                  <div className="text-xs text-muted-foreground">
                    Ref: {entry.referenceType}
                    {entry.referenceId ? ` · ${entry.referenceId}` : ""}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

type AuditActor = {
  id: string;
  name?: string | null;
  email?: string;
  role?: "user" | "reviewer" | "admin";
};

type AuditLogItem = {
  id: string;
  action: string;
  actorRole: "reviewer" | "admin";
  details: Record<string, unknown>;
  createdAt: string;
  actor: AuditActor | null;
  targetUser: AuditActor | null;
};

type AuditResponse = {
  logs?: AuditLogItem[];
  error?: string;
};

type FilterState = {
  action: string;
  actorId: string;
  targetUserId: string;
  from: string;
  to: string;
  limit: string;
};

function buildQuery(filters: FilterState): string {
  const params = new URLSearchParams();
  if (filters.action.trim()) params.set("action", filters.action.trim());
  if (filters.actorId.trim()) params.set("actorId", filters.actorId.trim());
  if (filters.targetUserId.trim()) params.set("targetUserId", filters.targetUserId.trim());
  if (filters.from.trim()) params.set("from", filters.from.trim());
  if (filters.to.trim()) params.set("to", filters.to.trim());
  if (filters.limit.trim()) params.set("limit", filters.limit.trim());
  const query = params.toString();
  return query ? `?${query}` : "";
}

function displayUser(user: AuditActor | null): string {
  if (!user) return "—";
  if (user.name && user.email) return `${user.name} (${user.email})`;
  if (user.email) return user.email;
  if (user.name) return user.name;
  return user.id;
}

export default function AdminAuditLogClient() {
  const [formFilters, setFormFilters] = useState<FilterState>({
    action: "",
    actorId: "",
    targetUserId: "",
    from: "",
    to: "",
    limit: "100",
  });
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(formFilters);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);

  const query = useMemo(() => buildQuery(appliedFilters), [appliedFilters]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    fetch(`/api/admin/audit${query}`, { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as AuditResponse | null;
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load audit log");
        }

        if (cancelled) return;
        setLogs(Array.isArray(data?.logs) ? data.logs : []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load audit log");
        setLogs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div className="space-y-6">
      <div className="rounded-[var(--radius-2xl)] border border-border bg-card p-4 space-y-4">
        <div>
          <div className="text-foreground font-semibold text-lg">Audit filters</div>
          <div className="text-sm text-muted-foreground">
            Filter admin safety events by actor, target, action, and time range.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-xs text-muted-foreground flex flex-col gap-1">
            Action
            <input
              value={formFilters.action}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, action: e.target.value }))}
              placeholder="user_frozen"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted-foreground flex flex-col gap-1">
            Actor user ID
            <input
              value={formFilters.actorId}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, actorId: e.target.value }))}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted-foreground flex flex-col gap-1">
            Target user ID
            <input
              value={formFilters.targetUserId}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, targetUserId: e.target.value }))}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted-foreground flex flex-col gap-1">
            From (ISO date/time)
            <input
              value={formFilters.from}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, from: e.target.value }))}
              placeholder="2026-03-31T00:00:00Z"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted-foreground flex flex-col gap-1">
            To (ISO date/time)
            <input
              value={formFilters.to}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, to: e.target.value }))}
              placeholder="2026-03-31T23:59:59Z"
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
            onClick={() =>
              setFormFilters({
                action: "",
                actorId: "",
                targetUserId: "",
                from: "",
                to: "",
                limit: "100",
              })
            }
            className="rounded-[var(--radius-xl)] border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Clear form
          </button>
          <button
            type="button"
            onClick={() =>
              setAppliedFilters({
                action: "",
                actorId: "",
                targetUserId: "",
                from: "",
                to: "",
                limit: "100",
              })
            }
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
      </div>

      {loading ? (
        <div className="rounded-[var(--radius-2xl)] border border-border bg-card p-6 text-muted-foreground">Loading audit log…</div>
      ) : error ? (
        <div className="rounded-[var(--radius-2xl)] border border-border bg-card p-6 text-red-600">{error}</div>
      ) : logs.length === 0 ? (
        <div className="rounded-[var(--radius-2xl)] border border-border bg-card p-6 text-muted-foreground">No audit entries matched your filters.</div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="rounded-[var(--radius-2xl)] border border-border bg-card p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-foreground">{log.action}</div>
                <div className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">
                  Actor: <span className="text-foreground">{displayUser(log.actor)}</span>
                </div>
                <div className="text-muted-foreground">
                  Target: <span className="text-foreground">{displayUser(log.targetUser)}</span>
                </div>
              </div>
              <pre className="mt-2 overflow-auto rounded-[var(--radius-xl)] bg-background p-3 text-xs text-foreground border border-border">
                {JSON.stringify(log.details ?? {}, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

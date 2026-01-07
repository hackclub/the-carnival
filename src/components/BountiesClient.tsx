"use client";

import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";

export type BountyListItem = {
  id: string;
  name: string;
  description: string;
  prizeUsd: number;
  claimedCount: number;
  claimedByMe: boolean;
  completed: boolean;
};

export default function BountiesClient({
  initial,
  isAdmin,
}: {
  initial: BountyListItem[];
  isAdmin: boolean;
}) {
  const [items, setItems] = useState<BountyListItem[]>(initial);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/bounties", { method: "GET" });
    const data = (await res.json().catch(() => null)) as { projects?: unknown; error?: unknown } | null;
    const raw = Array.isArray(data?.projects) ? (data!.projects as unknown[]) : [];
    const next = raw
      .map((p) => p as Partial<BountyListItem>)
      .filter((p) => typeof p.id === "string")
      .map((p) => ({
        id: p.id!,
        name: String(p.name ?? ""),
        description: String(p.description ?? ""),
        prizeUsd: Number(p.prizeUsd ?? 0),
        claimedCount: Number(p.claimedCount ?? 0),
        claimedByMe: Boolean(p.claimedByMe),
        completed: Boolean(p.completed),
      }));
    setItems(next);
  }, []);

  const onCreate = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const description = String(fd.get("description") ?? "").trim();
    const prizeUsd = Number(fd.get("prizeUsd") ?? 0);

    setCreating(true);
    const toastId = toast.loading("Creating bounty…");
    try {
      const res = await fetch("/api/bounties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, prizeUsd }),
      });
      const data = (await res.json().catch(() => null)) as { id?: string; error?: unknown } | null;
      if (!res.ok) {
        const message = typeof data?.error === "string" ? data.error : "Failed to create bounty.";
        toast.error(message, { id: toastId });
        setCreating(false);
        return;
      }
      toast.success("Created.", { id: toastId });
      e.currentTarget.reset();
      await refresh();
      setCreating(false);
    } catch {
      toast.error("Failed to create bounty.", { id: toastId });
      setCreating(false);
    }
  }, [refresh]);

  const claim = useCallback(
    async (id: string) => {
      const toastId = toast.loading("Claiming…");
      try {
        const res = await fetch(`/api/bounties/${encodeURIComponent(id)}/claim`, {
          method: "POST",
        });
        const data = (await res.json().catch(() => null)) as
          | { claimedCount?: unknown; claimedByMe?: unknown; error?: unknown }
          | null;

        if (!res.ok) {
          const message = typeof data?.error === "string" ? data.error : "Failed to claim.";
          toast.error(message, { id: toastId });
          await refresh();
          return;
        }

        toast.success("Claimed.", { id: toastId });
        await refresh();
      } catch {
        toast.error("Failed to claim.", { id: toastId });
      }
    },
    [refresh],
  );

  const markCompleted = useCallback(
    async (id: string, completed: boolean) => {
      const toastId = toast.loading(completed ? "Marking as completed…" : "Reopening bounty…");
      try {
        const res = await fetch(`/api/bounties/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
          const message = typeof data?.error === "string" ? data.error : "Failed to update.";
          toast.error(message, { id: toastId });
          return;
        }

        toast.success(completed ? "Bounty marked as completed" : "Bounty reopened", { id: toastId });
        await refresh();
      } catch {
        toast.error("Failed to update.", { id: toastId });
      }
    },
    [refresh],
  );

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      // Completed bounties go to the end
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      // Available first, then by prize desc.
      const aAvail = a.claimedCount < 2 ? 1 : 0;
      const bAvail = b.claimedCount < 2 ? 1 : 0;
      if (aAvail !== bAvail) return bAvail - aAvail;
      return (b.prizeUsd ?? 0) - (a.prizeUsd ?? 0);
    });
  }, [items]);

  return (
    <div className="space-y-6">
      {isAdmin ? (
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="text-foreground font-semibold text-lg">Create bounty</div>
          <div className="text-muted-foreground mt-1 text-sm">
            Only admins can create bounty projects.
          </div>

          <form onSubmit={onCreate} className="mt-5 space-y-4">
            <label className="block">
              <div className="text-sm text-muted-foreground font-medium mb-2">Name</div>
              <input
                name="name"
                required
                className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
                placeholder="Build a VS Code extension for XYZ"
                disabled={creating}
              />
            </label>

            <label className="block">
              <div className="text-sm text-muted-foreground font-medium mb-2">Prize (USD)</div>
              <input
                name="prizeUsd"
                type="number"
                min={1}
                step={1}
                required
                className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
                placeholder="50"
                disabled={creating}
              />
            </label>

            <label className="block">
              <div className="text-sm text-muted-foreground font-medium mb-2">Description</div>
              <textarea
                name="description"
                rows={4}
                required
                className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
                placeholder="What should the bounty project do? What are acceptance criteria?"
                disabled={creating}
              />
            </label>

            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-full font-bold transition-colors"
              >
                {creating ? "Creating…" : "Create bounty"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {sorted.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8">
          <div className="text-foreground font-semibold text-lg">No bounties yet</div>
          <div className="text-muted-foreground mt-1">
            Check back soon.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {sorted.map((b) => {
            const isFull = b.claimedCount >= 2;
            const isCompleted = b.completed;
            const canClaim = !isFull && !b.claimedByMe && !isCompleted;
            return (
              <div
                key={b.id}
                className={[
                  "bg-card border border-border rounded-2xl p-6 card-glow transition-all",
                  isCompleted ? "opacity-50" : isFull ? "opacity-70" : "hover:bg-muted",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-foreground font-bold text-xl truncate">{b.name}</div>
                      {isCompleted && (
                        <span className="shrink-0 px-2 py-0.5 text-xs font-medium rounded-full bg-green-500/10 text-green-600 ring-1 ring-green-500/20">
                          Completed
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground mt-2 overflow-hidden">{b.description}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm text-muted-foreground">Prize</div>
                    <div className="text-foreground font-bold text-lg">${b.prizeUsd}</div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Claims: <span className="text-foreground font-semibold">{b.claimedCount}/2</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => markCompleted(b.id, !isCompleted)}
                        className="inline-flex items-center justify-center px-3 py-2 rounded-full text-sm font-medium transition-colors border border-border hover:bg-muted"
                      >
                        {isCompleted ? "Reopen" : "Mark Done"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => claim(b.id)}
                      disabled={!canClaim}
                      className={[
                        "inline-flex items-center justify-center px-5 py-2 rounded-full font-semibold transition-colors border",
                        canClaim
                          ? "bg-carnival-blue/20 hover:bg-carnival-blue/30 text-foreground border-border"
                          : "bg-muted text-muted-foreground border-border cursor-not-allowed",
                      ].join(" ")}
                    >
                      {isCompleted ? "Done" : b.claimedByMe ? "Claimed" : isFull ? "Full" : "Claim"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}



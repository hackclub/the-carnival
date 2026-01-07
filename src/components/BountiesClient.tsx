"use client";

import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Input, Textarea, Button, Card, Badge, EmptyState } from "@/components/ui";

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
    const data = (await res.json().catch(() => null)) as { projects?: unknown } | null;
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

  const onCreate = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
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
        const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
        if (!res.ok) {
          toast.error(typeof data?.error === "string" ? data.error : "Failed to create bounty.", { id: toastId });
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
    },
    [refresh]
  );

  const claim = useCallback(
    async (id: string) => {
      const toastId = toast.loading("Claiming…");
      try {
        const res = await fetch(`/api/bounties/${encodeURIComponent(id)}/claim`, { method: "POST" });
        const data = (await res.json().catch(() => null)) as { error?: unknown } | null;

        if (!res.ok) {
          toast.error(typeof data?.error === "string" ? data.error : "Failed to claim.", { id: toastId });
          await refresh();
          return;
        }

        toast.success("Claimed.", { id: toastId });
        await refresh();
      } catch {
        toast.error("Failed to claim.", { id: toastId });
      }
    },
    [refresh]
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
          toast.error(typeof data?.error === "string" ? data.error : "Failed to update.", { id: toastId });
          return;
        }

        toast.success(completed ? "Bounty marked as completed" : "Bounty reopened", { id: toastId });
        await refresh();
      } catch {
        toast.error("Failed to update.", { id: toastId });
      }
    },
    [refresh]
  );

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const aAvail = a.claimedCount < 2 ? 1 : 0;
      const bAvail = b.claimedCount < 2 ? 1 : 0;
      if (aAvail !== bAvail) return bAvail - aAvail;
      return (b.prizeUsd ?? 0) - (a.prizeUsd ?? 0);
    });
  }, [items]);

  return (
    <div className="space-y-6">
      {isAdmin && (
        <Card className="p-6">
          <div className="text-foreground font-semibold text-lg">Create bounty</div>
          <div className="text-muted-foreground mt-1 text-sm">Only admins can create bounty projects.</div>

          <form onSubmit={onCreate} className="mt-5 space-y-4">
            <Input
              name="name"
              label="Name"
              required
              placeholder="Build a VS Code extension for XYZ"
              disabled={creating}
            />
            <Input
              name="prizeUsd"
              label="Prize (USD)"
              type="number"
              min={1}
              step={1}
              required
              placeholder="50"
              disabled={creating}
            />
            <Textarea
              name="description"
              label="Description"
              rows={4}
              required
              placeholder="What should the bounty project do? What are acceptance criteria?"
              disabled={creating}
            />
            <div className="flex items-center justify-end">
              <Button type="submit" loading={creating} loadingText="Creating…">
                Create bounty
              </Button>
            </div>
          </form>
        </Card>
      )}

      {sorted.length === 0 ? (
        <EmptyState title="No bounties yet" description="Check back soon." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {sorted.map((b) => {
            const isFull = b.claimedCount >= 2;
            const isCompleted = b.completed;
            const canClaim = !isFull && !b.claimedByMe && !isCompleted;

            return (
              <Card
                key={b.id}
                className={`p-6 ${isCompleted ? "opacity-50" : isFull ? "opacity-70" : "hover:bg-muted"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-foreground font-bold text-xl truncate">{b.name}</div>
                      {isCompleted && <Badge variant="success">Completed</Badge>}
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
                      <Button variant="outline" onClick={() => markCompleted(b.id, !isCompleted)}>
                        {isCompleted ? "Reopen" : "Mark Done"}
                      </Button>
                    )}
                    <Button
                      variant={canClaim ? "secondary" : "disabled"}
                      onClick={() => claim(b.id)}
                      disabled={!canClaim}
                    >
                      {isCompleted ? "Done" : b.claimedByMe ? "Claimed" : isFull ? "Full" : "Claim"}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

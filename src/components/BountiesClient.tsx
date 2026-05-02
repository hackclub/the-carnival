"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Input, Textarea, Button, Card, Badge, EmptyState, FormLabel, Modal } from "@/components/ui";
import { R2ImageUpload } from "@/components/R2ImageUpload";
import { RichTextContent } from "@/components/RichTextContent";
import { RichTextField } from "@/components/RichTextField";

const GRANT_USD_PER_HOUR = 4;

export type BountyHelpfulLink = {
  label: string;
  url: string;
};

function createEmptyHelpfulLink(): BountyHelpfulLink {
  return { label: "", url: "" };
}

function getInitialHelpfulLinksDraft(value: BountyHelpfulLink[]) {
  if (value.length === 0) return [createEmptyHelpfulLink()];
  return value.map((link) => ({ ...link }));
}

function parseHelpfulLinks(value: unknown): BountyHelpfulLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const label =
        typeof (item as { label?: unknown }).label === "string"
          ? (item as { label: string }).label.trim()
          : "";
      const url =
        typeof (item as { url?: unknown }).url === "string" ? (item as { url: string }).url.trim() : "";
      if (!label || !url) return null;
      return { label, url };
    })
    .filter((item): item is BountyHelpfulLink => Boolean(item));
}

function prepareHelpfulLinksDraft(draft: BountyHelpfulLink[]) {
  const normalizedHelpfulLinks = draft.map((link) => ({
    label: link.label.trim(),
    url: link.url.trim(),
  }));

  const partialLink = normalizedHelpfulLinks.find(
    (link) => (link.label && !link.url) || (!link.label && link.url),
  );
  if (partialLink) {
    return {
      helpfulLinks: [] as BountyHelpfulLink[],
      error: "Each helpful link needs both a label and URL.",
    };
  }

  const helpfulLinks = normalizedHelpfulLinks.filter((link) => link.label && link.url);
  for (const link of helpfulLinks) {
    try {
      const parsed = new URL(link.url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("invalid protocol");
      }
    } catch {
      return {
        helpfulLinks: [] as BountyHelpfulLink[],
        error: `Invalid URL for "${link.label}"`,
      };
    }
  }

  return { helpfulLinks, error: null as string | null };
}

function getEquivalentHours(prizeUsd: number) {
  const normalizedPrizeUsd = Number.isFinite(prizeUsd) ? Math.max(0, prizeUsd) : 0;
  return normalizedPrizeUsd / GRANT_USD_PER_HOUR;
}

function getMinimumHoursForBounty(prizeUsd: number) {
  return getEquivalentHours(prizeUsd) / 2 + 1;
}

function formatHoursLabel(hours: number) {
  const normalizedHours = Number.isFinite(hours) ? Math.max(0, hours) : 0;
  const roundedHours = Number.isInteger(normalizedHours)
    ? normalizedHours.toString()
    : normalizedHours.toFixed(2).replace(/\.?0+$/, "");
  return `${roundedHours} hour${normalizedHours === 1 ? "" : "s"}`;
}

function HelpfulLinksFields({
  value,
  onChange,
  disabled,
}: {
  value: BountyHelpfulLink[];
  onChange: (next: BountyHelpfulLink[]) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <FormLabel>Helpful links (optional)</FormLabel>
      <div className="space-y-3">
        {value.map((link, index) => (
          <div key={`helpful-link-${index}`} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
            <Input
              placeholder="Docs"
              value={link.label}
              onChange={(e) => {
                const next = [...value];
                next[index] = { ...next[index], label: e.target.value };
                onChange(next);
              }}
              disabled={disabled}
            />
            <Input
              placeholder="https://example.com/guide"
              value={link.url}
              onChange={(e) => {
                const next = [...value];
                next[index] = { ...next[index], url: e.target.value };
                onChange(next);
              }}
              disabled={disabled}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (value.length === 1) {
                  onChange([createEmptyHelpfulLink()]);
                  return;
                }
                onChange(value.filter((_, i) => i !== index));
              }}
              disabled={disabled}
            >
              Remove
            </Button>
          </div>
        ))}
        <div className="flex items-center">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onChange([...value, createEmptyHelpfulLink()])}
            disabled={disabled}
          >
            Add link
          </Button>
        </div>
      </div>
    </div>
  );
}

export type BountyListItem = {
  id: string;
  name: string;
  description: string;
  status: "pending" | "approved" | "rejected";
  prizeUsd: number;
  previewImageUrl: string | null;
  requirements: string;
  examples: string;
  helpfulLinks: BountyHelpfulLink[];
  claimedCount: number;
  claimedByMe: boolean;
  completed: boolean;
  createdById: string | null;
  authorName: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt?: string;
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
  const [createDescription, setCreateDescription] = useState("");
  const [createRequirements, setCreateRequirements] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [helpfulLinksDraft, setHelpfulLinksDraft] = useState<BountyHelpfulLink[]>([
    createEmptyHelpfulLink(),
  ]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [editingPrizeUsd, setEditingPrizeUsd] = useState("");
  const [editingPreviewImageUrl, setEditingPreviewImageUrl] = useState("");
  const [editingRequirements, setEditingRequirements] = useState("");
  const [editingExamples, setEditingExamples] = useState("");
  const [editingHelpfulLinksDraft, setEditingHelpfulLinksDraft] = useState<BountyHelpfulLink[]>([
    createEmptyHelpfulLink(),
  ]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const editBusy = editingId !== null && (savingEdit || deletingId === editingId);

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
        status:
          p.status === "pending" || p.status === "rejected"
            ? p.status
            : ("approved" as BountyListItem["status"]),
        prizeUsd: Number(p.prizeUsd ?? 0),
        previewImageUrl: typeof p.previewImageUrl === "string" && p.previewImageUrl.trim() ? p.previewImageUrl : null,
        requirements: String(p.requirements ?? ""),
        examples: String(p.examples ?? ""),
        helpfulLinks: parseHelpfulLinks(p.helpfulLinks),
        claimedCount: Number(p.claimedCount ?? 0),
        claimedByMe: Boolean(p.claimedByMe),
        completed: Boolean(p.completed),
        createdById: typeof p.createdById === "string" ? p.createdById : null,
        authorName: typeof p.authorName === "string" ? p.authorName : null,
        reviewedById: typeof p.reviewedById === "string" ? p.reviewedById : null,
        reviewedAt: typeof p.reviewedAt === "string" ? p.reviewedAt : null,
        rejectionReason: typeof p.rejectionReason === "string" ? p.rejectionReason : null,
        createdAt: typeof p.createdAt === "string" ? p.createdAt : undefined,
      }));
    setItems(next);
  }, []);

  const closeEditModal = useCallback(() => {
    if (editBusy) return;
    setEditingId(null);
    setEditingName("");
    setEditingDescription("");
    setEditingPrizeUsd("");
    setEditingPreviewImageUrl("");
    setEditingRequirements("");
    setEditingExamples("");
    setEditingHelpfulLinksDraft([createEmptyHelpfulLink()]);
  }, [editBusy]);

  const openEditModal = useCallback((item: BountyListItem) => {
    setEditingId(item.id);
    setEditingName(item.name);
    setEditingDescription(item.description);
    setEditingPrizeUsd(String(item.prizeUsd));
    setEditingPreviewImageUrl(item.previewImageUrl ?? "");
    setEditingRequirements(item.requirements ?? "");
    setEditingExamples(item.examples ?? "");
    setEditingHelpfulLinksDraft(getInitialHelpfulLinksDraft(item.helpfulLinks));
  }, []);

  const onCreate = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const name = String(fd.get("name") ?? "").trim();
      const description = createDescription.trim();
      const prizeUsd = Number(fd.get("prizeUsd") ?? 0);
      const requirements = createRequirements.trim();
      const examples = String(fd.get("examples") ?? "").trim();
      const { helpfulLinks, error } = prepareHelpfulLinksDraft(helpfulLinksDraft);
      if (error) {
        toast.error(error);
        return;
      }

      setCreating(true);
      const toastId = toast.loading("Creating bounty…");
      try {
        const res = await fetch("/api/bounties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            prizeUsd,
            previewImageUrl,
            requirements,
            examples,
            helpfulLinks,
          }),
        });
        const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
        if (!res.ok) {
          toast.error(typeof data?.error === "string" ? data.error : "Failed to create bounty.", {
            id: toastId,
          });
          setCreating(false);
          return;
        }
        toast.success(isAdmin ? "Created." : "Proposal submitted for admin review.", { id: toastId });
        e.currentTarget.reset();
        setCreateDescription("");
        setCreateRequirements("");
        setPreviewImageUrl("");
        setHelpfulLinksDraft([createEmptyHelpfulLink()]);
        await refresh();
        setCreating(false);
      } catch {
        toast.error("Failed to create bounty.", { id: toastId });
        setCreating(false);
      }
    },
    [createDescription, createRequirements, helpfulLinksDraft, isAdmin, previewImageUrl, refresh],
  );

  const onSaveEdit = useCallback(async () => {
    if (!editingId) return;

    const name = editingName.trim();
    const description = editingDescription.trim();
    const prizeUsd = Number(editingPrizeUsd);

    if (!name) {
      toast.error("Name is required.");
      return;
    }
    if (!description) {
      toast.error("Description is required.");
      return;
    }
    if (!Number.isFinite(prizeUsd) || prizeUsd <= 0) {
      toast.error("Prize must be a positive USD amount.");
      return;
    }

    const { helpfulLinks, error } = prepareHelpfulLinksDraft(editingHelpfulLinksDraft);
    if (error) {
      toast.error(error);
      return;
    }

    setSavingEdit(true);
    const toastId = toast.loading("Saving bounty…");
    try {
      const res = await fetch(`/api/bounties/${encodeURIComponent(editingId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            prizeUsd,
            previewImageUrl: editingPreviewImageUrl,
            requirements: editingRequirements,
            examples: editingExamples,
            helpfulLinks,
          }),
        });
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null;

      if (!res.ok) {
        toast.error(typeof data?.error === "string" ? data.error : "Failed to save bounty.", {
          id: toastId,
        });
        setSavingEdit(false);
        return;
      }

      toast.success("Saved.", { id: toastId });
      closeEditModal();
      await refresh();
      setSavingEdit(false);
    } catch {
      toast.error("Failed to save bounty.", { id: toastId });
      setSavingEdit(false);
    }
  }, [
    closeEditModal,
    editingDescription,
    editingHelpfulLinksDraft,
    editingId,
    editingName,
    editingPreviewImageUrl,
    editingPrizeUsd,
    editingRequirements,
    editingExamples,
    refresh,
  ]);

  const onDeleteBounty = useCallback(async () => {
    if (!editingId) return;
    if (!confirm("Delete this bounty? This cannot be undone.")) return;

    setDeletingId(editingId);
    const toastId = toast.loading("Deleting bounty…");
    try {
      const res = await fetch(`/api/bounties/${encodeURIComponent(editingId)}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null;

      if (!res.ok) {
        toast.error(typeof data?.error === "string" ? data.error : "Failed to delete bounty.", {
          id: toastId,
        });
        setDeletingId(null);
        return;
      }

      toast.success("Deleted.", { id: toastId });
      closeEditModal();
      await refresh();
      setDeletingId(null);
    } catch {
      toast.error("Failed to delete bounty.", { id: toastId });
      setDeletingId(null);
    }
  }, [closeEditModal, editingId, refresh]);

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
          toast.error(typeof data?.error === "string" ? data.error : "Failed to update.", { id: toastId });
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

  const updateStatus = useCallback(
    async (id: string, status: BountyListItem["status"], reason = "") => {
      const toastId = toast.loading(
        status === "approved" ? "Approving bounty…" : status === "rejected" ? "Rejecting bounty…" : "Updating…",
      );
      try {
        const res = await fetch(`/api/bounties/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, rejectionReason: reason }),
        });
        const data = (await res.json().catch(() => null)) as { error?: unknown } | null;

        if (!res.ok) {
          toast.error(typeof data?.error === "string" ? data.error : "Failed to update.", { id: toastId });
          return;
        }

        toast.success(status === "approved" ? "Bounty is now official." : "Bounty rejected.", {
          id: toastId,
        });
        setRejectingId(null);
        setRejectionReason("");
        await refresh();
      } catch {
        toast.error("Failed to update.", { id: toastId });
      }
    },
    [refresh],
  );

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const statusRank = { pending: 0, approved: 1, rejected: 2 } as const;
      if (a.status !== b.status) return statusRank[a.status] - statusRank[b.status];
      const aAvail = a.claimedCount < 2 ? 1 : 0;
      const bAvail = b.claimedCount < 2 ? 1 : 0;
      if (aAvail !== bAvail) return bAvail - aAvail;
      return (b.prizeUsd ?? 0) - (a.prizeUsd ?? 0);
    });
  }, [items]);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="text-foreground font-semibold text-lg">How bounty eligibility works</div>
        <div className="text-muted-foreground mt-2 text-sm leading-6">
          Every bounty bonus is shown as an hours equivalent using Carnival&apos;s $
          <span className="text-foreground font-medium">{GRANT_USD_PER_HOUR}/hour</span> rate. To earn the bounty,
          your extension still needs to meet the bounty requirements in the description, and you need to spend at
          least{" "}
          <span className="text-foreground font-medium">(hours needed for the extension / 2) + 1 hour</span>.
        </div>
      </Card>

      <Card className="p-6">
          <div className="text-foreground font-semibold text-lg">
            {isAdmin ? "Create official bounty" : "Submit a bounty proposal"}
          </div>
          <div className="text-muted-foreground mt-1 text-sm">
            {isAdmin
              ? "Admin-created bounties go live immediately."
              : "An admin will review your proposal before it becomes official."}
          </div>

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
              placeholder="250"
              disabled={creating}
            />
            <R2ImageUpload
              label="Preview image (optional)"
              value={previewImageUrl}
              onChange={setPreviewImageUrl}
              kind="bounty_preview"
              disabled={creating}
              helperText="A visual preview for the bounty card and detail page."
            />
            <RichTextField
              name="description"
              label="Description"
              value={createDescription}
              onChange={setCreateDescription}
              rows={7}
              required
              placeholder="What should the bounty extension do? List the requirements and acceptance criteria."
              disabled={creating}
            />
            <RichTextField
              name="requirements"
              label="Requirements (optional)"
              value={createRequirements}
              onChange={setCreateRequirements}
              rows={7}
              placeholder="What must a project do to qualify?"
              disabled={creating}
            />
            <Textarea
              name="examples"
              label="Examples or resources (optional)"
              rows={3}
              placeholder="Example ideas, references, APIs, or starter resources."
              disabled={creating}
            />
            <HelpfulLinksFields
              value={helpfulLinksDraft}
              onChange={setHelpfulLinksDraft}
              disabled={creating}
            />
            <div className="flex items-center justify-end">
              <Button type="submit" loading={creating} loadingText="Creating…">
                {isAdmin ? "Create bounty" : "Submit proposal"}
              </Button>
            </div>
          </form>
      </Card>

      {sorted.length === 0 ? (
        <EmptyState title="No bounties yet" description="Check back soon." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {sorted.map((b) => {
            const isFull = b.claimedCount >= 2;
            const isCompleted = b.completed;
            const isOfficial = b.status === "approved";
            const canClaim = isOfficial && !isFull && !b.claimedByMe && !isCompleted;
            const equivalentHours = getEquivalentHours(b.prizeUsd);
            const minimumHours = getMinimumHoursForBounty(b.prizeUsd);

            return (
              <Card
                key={b.id}
                className={`p-6 ${isCompleted ? "opacity-50" : isFull ? "opacity-70" : "hover:bg-muted"}`}
              >
                <Link href={`/bounties/${encodeURIComponent(b.id)}`} className="block -mx-1 -mt-1 rounded-[var(--radius-xl)] p-1 hover:bg-background/40">
                  {b.previewImageUrl ? (
                    <div className="mb-4 h-40 overflow-hidden rounded-[var(--radius-xl)] border border-border bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={b.previewImageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : null}
                </Link>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/bounties/${encodeURIComponent(b.id)}`}
                        className="text-foreground font-bold text-xl truncate hover:underline"
                      >
                        {b.name}
                      </Link>
                      {isCompleted && <Badge variant="success">Completed</Badge>}
                      {b.status === "pending" && <Badge variant="warning">Pending</Badge>}
                      {b.status === "rejected" && <Badge variant="error">Rejected</Badge>}
                    </div>
                    <div className="text-muted-foreground mt-1 text-sm">
                      by <span className="text-foreground font-medium">{b.authorName || "Unknown creator"}</span>
                    </div>
                    <RichTextContent value={b.description} className="mt-2 text-muted-foreground" clamp />
                    {b.requirements ? (
                      <div className="mt-3 rounded-[var(--radius-xl)] border border-border bg-muted/40 px-3 py-2 text-sm">
                        <div className="font-semibold text-foreground">Requirements</div>
                        <RichTextContent value={b.requirements} className="mt-1 text-muted-foreground" clamp />
                      </div>
                    ) : null}
                    {b.helpfulLinks.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {b.helpfulLinks.map((link, idx) => (
                          <a
                            key={`${b.id}-helpful-link-${idx}`}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-carnival-blue hover:underline break-all"
                          >
                            {link.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm text-muted-foreground">Prize</div>
                    <div className="text-foreground font-bold text-lg">${b.prizeUsd.toLocaleString("en-US")}</div>
                  </div>
                </div>

                {isOfficial ? (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[var(--radius-2xl)] border border-border bg-muted/40 px-4 py-3">
                      <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Hours Equivalent
                      </div>
                      <div className="mt-1 text-base font-semibold text-foreground">
                        {formatHoursLabel(equivalentHours)}
                      </div>
                    </div>
                    <div className="rounded-[var(--radius-2xl)] border border-border bg-muted/40 px-4 py-3">
                      <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Minimum Hours
                      </div>
                      <div className="mt-1 text-base font-semibold text-foreground">
                        {formatHoursLabel(minimumHours)}
                      </div>
                    </div>
                  </div>
                ) : null}

                {isOfficial ? (
                  <div className="mt-3 text-sm text-muted-foreground">
                    Your extension must meet every bounty requirement above to qualify for the payout.
                  </div>
                ) : null}
                {b.status === "rejected" && b.rejectionReason ? (
                  <div className="mt-3 rounded-[var(--radius-xl)] border border-carnival-red/40 bg-carnival-red/10 px-3 py-2 text-sm text-red-200">
                    {b.rejectionReason}
                  </div>
                ) : null}

                <div className="mt-6 flex items-center justify-between gap-4">
                  <div className="text-sm text-muted-foreground">
                    {isOfficial ? (
                      <>
                        Claims: <span className="text-foreground font-semibold">{b.claimedCount}/2</span>
                      </>
                    ) : (
                      "Proposal review"
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Link
                      href={`/bounties/${encodeURIComponent(b.id)}`}
                      className="inline-flex items-center justify-center px-5 py-2 rounded-[var(--radius-xl)] font-semibold transition-colors border border-border hover:bg-muted"
                    >
                      View
                    </Link>
                    {isAdmin && (
                      <Button type="button" variant="ghost" onClick={() => openEditModal(b)}>
                        Edit
                      </Button>
                    )}
                    {isAdmin && b.status === "pending" && (
                      <Button type="button" variant="secondary" onClick={() => updateStatus(b.id, "approved")}>
                        Approve
                      </Button>
                    )}
                    {isAdmin && b.status === "pending" && (
                      <Button type="button" variant="outline" onClick={() => setRejectingId(b.id)}>
                        Reject
                      </Button>
                    )}
                    {isAdmin && isOfficial && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => markCompleted(b.id, !isCompleted)}
                      >
                        {isCompleted ? "Reopen" : "Mark Done"}
                      </Button>
                    )}
                    {isOfficial ? (
                      <Button
                        type="button"
                        variant={canClaim ? "secondary" : "disabled"}
                        onClick={() => claim(b.id)}
                        disabled={!canClaim}
                      >
                        {isCompleted ? "Done" : b.claimedByMe ? "Claimed" : isFull ? "Full" : "Claim"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={editingId !== null}
        onClose={closeEditModal}
        title="Edit bounty"
        description="Update the title, description, prize, and helpful links. The prize amount drives the hours shown on the page."
        maxWidth="xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSaveEdit();
          }}
          className="space-y-4"
        >
          <Input
            label="Name"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            required
            disabled={editBusy}
          />
          <Input
            label="Prize (USD)"
            type="number"
            min={1}
            step={1}
            value={editingPrizeUsd}
            onChange={(e) => setEditingPrizeUsd(e.target.value)}
            required
            disabled={editBusy}
          />
          <R2ImageUpload
            label="Preview image (optional)"
            value={editingPreviewImageUrl}
            onChange={setEditingPreviewImageUrl}
            kind="bounty_preview"
            disabled={editBusy}
          />
          <RichTextField
            label="Description"
            value={editingDescription}
            onChange={setEditingDescription}
            rows={7}
            required
            placeholder="What should the bounty extension do? List the requirements and acceptance criteria."
            disabled={editBusy}
          />
          <RichTextField
            label="Requirements (optional)"
            value={editingRequirements}
            onChange={setEditingRequirements}
            rows={7}
            placeholder="What must a project do to qualify?"
            disabled={editBusy}
          />
          <Textarea
            label="Examples or resources (optional)"
            rows={3}
            value={editingExamples}
            onChange={(e) => setEditingExamples(e.target.value)}
            placeholder="Example ideas, references, APIs, or starter resources."
            disabled={editBusy}
          />
          <HelpfulLinksFields
            value={editingHelpfulLinksDraft}
            onChange={setEditingHelpfulLinksDraft}
            disabled={editBusy}
          />
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => void onDeleteBounty()}
              disabled={editBusy}
              className="mr-auto inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-[var(--radius-xl)] font-bold transition-colors"
            >
              {deletingId === editingId ? "Deleting…" : "Delete bounty"}
            </button>
            <Button
              type="button"
              variant="ghost"
              onClick={closeEditModal}
              disabled={editBusy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={savingEdit}
              loadingText="Saving…"
              disabled={deletingId === editingId}
            >
              Save changes
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={rejectingId !== null}
        onClose={() => {
          setRejectingId(null);
          setRejectionReason("");
        }}
        title="Reject bounty proposal"
        description="The creator will see this proposal as rejected."
        maxWidth="lg"
      >
        <div className="space-y-4">
          <Textarea
            label="Reason (optional)"
            rows={4}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Explain what should change before this can become official."
          />
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setRejectingId(null);
                setRejectionReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (rejectingId) void updateStatus(rejectingId, "rejected", rejectionReason);
              }}
            >
              Reject proposal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

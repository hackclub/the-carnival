"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ProjectStatus } from "@/db/schema";
import { Modal } from "@/components/ui";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import toast from "react-hot-toast";

type DismissedProject = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  resubmissionBlocked: boolean;
  resubmissionBlockedAt: string | null;
  resubmissionBlockedReason: string | null;
  submittedAt: string | null;
  createdAt: string;
};

type DismissedCreator = {
  id: string;
  name: string;
  email: string;
};

type DismissedByAdmin = {
  id: string;
  name: string;
  email: string;
};

type LatestRejection = {
  id: string;
  reviewComment: string;
  createdAt: string;
  reviewerName: string;
  reviewerEmail: string;
};

export default function AdminDismissedClient({
  initial,
}: {
  initial: {
    project: DismissedProject;
    creator: DismissedCreator;
    dismissedBy: DismissedByAdmin | null;
    latestRejection: LatestRejection | null;
  };
}) {
  const router = useRouter();
  const [project, setProject] = useState(initial.project);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const onReenable = async () => {
    setSaving(true);
    const toastId = toast.loading("Re-enabling resubmission…");
    try {
      const res = await fetch(`/api/admin/projects/${encodeURIComponent(project.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resubmissionBlocked: false }),
      });
      const data = (await res.json().catch(() => null)) as
        | { project?: { resubmissionBlocked?: boolean }; error?: unknown }
        | null;
      if (!res.ok) {
        const message =
          typeof data?.error === "string" ? data.error : "Failed to re-enable resubmission.";
        toast.error(message, { id: toastId });
        setSaving(false);
        return;
      }
      toast.success("Resubmission re-enabled.", { id: toastId });
      setProject((p) => ({
        ...p,
        resubmissionBlocked: false,
        resubmissionBlockedAt: null,
        resubmissionBlockedReason: null,
      }));
      setConfirmOpen(false);
      setSaving(false);
      router.refresh();
    } catch {
      toast.error("Failed to re-enable resubmission.", { id: toastId });
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-[var(--radius-2xl)] p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-foreground font-bold text-2xl truncate">{project.name}</div>
            <div className="text-muted-foreground mt-1">
              by{" "}
              <span className="text-foreground font-medium">{initial.creator.name}</span>
              {initial.creator.email ? (
                <span className="text-muted-foreground"> &middot; {initial.creator.email}</span>
              ) : null}
            </div>
          </div>
          <ProjectStatusBadge status={project.status} />
        </div>
      </div>

      <div className="bg-card border border-border rounded-[var(--radius-2xl)] p-6 space-y-4">
        <div className="text-foreground font-semibold text-lg">Dismissal</div>
        {project.resubmissionBlocked ? (
          <>
            <div className="rounded-[var(--radius-2xl)] border border-carnival-red/40 bg-carnival-red/10 px-4 py-3 text-sm text-foreground">
              <div className="font-semibold mb-1">Resubmission is blocked.</div>
              <div className="text-muted-foreground">
                The creator cannot submit this project for review until an admin re-enables
                resubmission.
              </div>
            </div>
            <div className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-3 text-sm">
              <div className="text-muted-foreground mb-1">Reason shown to the creator</div>
              <div className="text-foreground whitespace-pre-wrap">
                {project.resubmissionBlockedReason?.trim() || "(no reason provided)"}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-3">
                <div className="text-muted-foreground mb-1">Dismissed at</div>
                <div className="text-foreground font-medium">
                  {project.resubmissionBlockedAt
                    ? new Date(project.resubmissionBlockedAt).toLocaleString()
                    : "—"}
                </div>
              </div>
              <div className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-3">
                <div className="text-muted-foreground mb-1">Dismissed by</div>
                <div className="text-foreground font-medium">
                  {initial.dismissedBy ? initial.dismissedBy.name : "Unknown admin"}
                </div>
                {initial.dismissedBy?.email ? (
                  <div className="text-muted-foreground text-xs">
                    {initial.dismissedBy.email}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={saving}
                className="inline-flex items-center justify-center bg-carnival-blue hover:bg-carnival-blue/80 disabled:bg-carnival-blue/50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-[var(--radius-xl)] font-bold transition-colors"
              >
                Re-enable resubmission
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
            This project is not currently blocked from resubmission.{" "}
            <Link href="/admin/dismissed" className="text-foreground font-semibold underline">
              Back to dismissed projects
            </Link>
            .
          </div>
        )}
      </div>

      {initial.latestRejection ? (
        <div className="bg-card border border-border rounded-[var(--radius-2xl)] p-6 space-y-3">
          <div className="text-foreground font-semibold text-lg">Most recent review</div>
          <div className="text-sm text-muted-foreground">
            {initial.latestRejection.reviewerName}
            {initial.latestRejection.reviewerEmail ? (
              <span> &middot; {initial.latestRejection.reviewerEmail}</span>
            ) : null}
            <span> &middot; {new Date(initial.latestRejection.createdAt).toLocaleString()}</span>
          </div>
          <div className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-3 text-sm text-foreground whitespace-pre-wrap">
            {initial.latestRejection.reviewComment || "(no comment)"}
          </div>
        </div>
      ) : null}

      <div className="bg-card border border-border rounded-[var(--radius-2xl)] p-6 space-y-2">
        <div className="text-foreground font-semibold text-lg">Project</div>
        <div className="text-muted-foreground whitespace-pre-wrap leading-7">
          {project.description}
        </div>
        <div className="pt-3 text-xs text-muted-foreground">
          Created: {new Date(project.createdAt).toLocaleString()}
          {project.submittedAt
            ? ` • Last submitted: ${new Date(project.submittedAt).toLocaleString()}`
            : ""}
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => {
          if (saving) return;
          setConfirmOpen(false);
        }}
        title="Re-enable resubmission?"
        description="The creator will be able to submit this project for review again."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
            Re-enabling does not change the project&rsquo;s current status. The creator will still
            need to address any feedback from prior reviews before resubmitting.
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                if (saving) return;
                setConfirmOpen(false);
              }}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-[var(--radius-xl)] border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onReenable()}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-[var(--radius-xl)] bg-carnival-blue hover:bg-carnival-blue/80 disabled:bg-carnival-blue/50 disabled:cursor-not-allowed text-white px-5 py-2.5 text-sm font-bold transition-colors"
            >
              {saving ? "Saving…" : "Re-enable resubmission"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

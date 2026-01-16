"use client";

import { useCallback, useMemo, useState } from "react";
import type { ProjectEditor, ProjectStatus, ReviewDecision } from "@/db/schema";
import { Modal } from "@/components/ui";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import ProjectEditorBadge from "@/components/ProjectEditorBadge";
import toast from "react-hot-toast";

type GrantProject = {
  id: string;
  name: string;
  description: string;
  editor: ProjectEditor;
  editorOther: string;
  hackatimeProjectName: string;
  playableUrl: string;
  codeUrl: string;
  screenshots: string[];
  status: ProjectStatus;
  approvedHours: number | null;
  createdAt: string; // ISO
  submittedAt: string | null; // ISO
  hackatimeUserId: string | null;
  hackatimeHours: { hours: number; minutes: number } | null;
};

type GrantCreator = {
  id: string;
  name: string;
  email: string;
  slackId: string;
  verificationStatus: string;
};

type GrantReviewItem = {
  id: string;
  decision: ReviewDecision;
  reviewComment: string;
  approvedHours: number | null;
  createdAt: string; // ISO
  reviewerName: string;
  reviewerEmail: string;
};

function formatYmd(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function formatHoursMinutes(hours: number, minutes: number) {
  const h = Number.isFinite(hours) ? Math.max(0, Math.floor(hours)) : 0;
  const m = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;
  return `${h}h${String(m).padStart(2, "0")}m`;
}

export default function AdminGrantClient({
  initial,
}: {
  initial: { project: GrantProject; creator: GrantCreator; reviews: GrantReviewItem[] };
}) {
  const [project, setProject] = useState(initial.project);
  const [busy, setBusy] = useState(false);
  const [showReviews, setShowReviews] = useState(false);
  const [showScreenshots, setShowScreenshots] = useState(false);
  const [screenshotIndex, setScreenshotIndex] = useState(0);

  const canGrant = useMemo(() => project.status === "shipped", [project.status]);
  const canUngrant = useMemo(() => project.status === "granted", [project.status]);

  const billyLink = useMemo(() => {
    const hackatimeId = project.hackatimeUserId?.trim();
    if (!hackatimeId) return null;
    const start = formatYmd(project.createdAt);
    const end = formatYmd(project.submittedAt ?? project.createdAt);
    if (!start || !end) return null;
    return `https://billy.3kh0.net/?u=${encodeURIComponent(hackatimeId)}&d=${start}-${end}`;
  }, [project.createdAt, project.hackatimeUserId, project.submittedAt]);

  const screenshots = project.screenshots ?? [];
  const activeScreenshot = screenshots[screenshotIndex] ?? null;

  const setStatus = useCallback(
    async (status: Extract<ProjectStatus, "shipped" | "granted">) => {
      setBusy(true);
      const toastId = toast.loading(status === "granted" ? "Granting…" : "Reverting…");
      try {
        const res = await fetch(`/api/admin/projects/${encodeURIComponent(project.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const data = (await res.json().catch(() => null)) as
          | { project?: { status?: ProjectStatus }; error?: unknown }
          | null;
        if (!res.ok) {
          const message = typeof data?.error === "string" ? data.error : "Failed to update status.";
          toast.error(message, { id: toastId });
          setBusy(false);
          return;
        }
        setProject((p) => ({ ...p, status: (data?.project?.status ?? status) as ProjectStatus }));
        toast.success("Updated.", { id: toastId });
        setBusy(false);
      } catch {
        toast.error("Failed to update status.", { id: toastId });
        setBusy(false);
      }
    },
    [project.id],
  );

  const onDeleteProject = useCallback(async () => {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    setBusy(true);
    const toastId = toast.loading("Deleting project…");
    try {
      const res = await fetch(`/api/admin/projects/${encodeURIComponent(project.id)}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
      if (!res.ok) {
        const message = typeof data?.error === "string" ? data.error : "Failed to delete project.";
        toast.error(message, { id: toastId });
        setBusy(false);
        return;
      }
      toast.success("Deleted.", { id: toastId });
      window.location.href = "/admin/grants";
    } catch {
      toast.error("Failed to delete project.", { id: toastId });
      setBusy(false);
    }
  }, [project.id]);

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-foreground font-bold text-2xl truncate">{project.name}</div>
            <div className="text-muted-foreground mt-1">Grant review &amp; creator context.</div>
          </div>
          <ProjectStatusBadge status={project.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="text-foreground font-semibold text-lg">Project</div>
          <div className="text-muted-foreground">{project.description}</div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Editor:{" "}
              <span className="text-foreground">
                <ProjectEditorBadge editor={project.editor} editorOther={project.editorOther} />
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowReviews(true)}
              className="text-sm font-semibold text-carnival-blue hover:underline"
            >
              View review comments
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-muted px-4 py-3">
              <div className="text-sm text-muted-foreground">Hackatime project</div>
              <div className="text-foreground font-semibold truncate">
                <span className="font-mono">{project.hackatimeProjectName || "—"}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-muted px-4 py-3">
              <div className="text-sm text-muted-foreground">Hackatime user_id</div>
              <div className="text-foreground font-semibold truncate">
                <span className="font-mono">{project.hackatimeUserId || "—"}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-muted px-4 py-3">
              <div className="text-sm text-muted-foreground">Hours logged (Hackatime)</div>
              <div className="text-foreground font-semibold">
                {project.hackatimeHours ? formatHoursMinutes(project.hackatimeHours.hours, project.hackatimeHours.minutes) : "—"}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-muted px-4 py-3">
              <div className="text-sm text-muted-foreground">Approved hours</div>
              <div className="text-foreground font-semibold">
                {project.approvedHours !== null && project.approvedHours !== undefined ? `${project.approvedHours}h` : "—"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <a
              href={project.playableUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-border bg-muted px-4 py-3 hover:bg-muted/70 transition-colors"
            >
              <div className="text-sm text-muted-foreground">Demo video</div>
              <div className="text-foreground font-semibold truncate">{project.playableUrl}</div>
            </a>
            <a
              href={project.codeUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-border bg-muted px-4 py-3 hover:bg-muted/70 transition-colors"
            >
              <div className="text-sm text-muted-foreground">GitHub</div>
              <div className="text-foreground font-semibold truncate">{project.codeUrl}</div>
            </a>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Created: {new Date(project.createdAt).toLocaleString()} • Submitted:{" "}
              {project.submittedAt ? new Date(project.submittedAt).toLocaleString() : "—"}
            </div>
            {billyLink ? (
              <a
                href={billyLink}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-carnival-blue hover:underline"
              >
                Review Hackatime (billy)
              </a>
            ) : null}
          </div>

          {project.screenshots?.length ? (
            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-foreground font-semibold">Screenshots</div>
                <button
                  type="button"
                  onClick={() => {
                    setScreenshotIndex(0);
                    setShowScreenshots(true);
                  }}
                  className="text-sm font-semibold text-carnival-blue hover:underline"
                >
                  View screenshots
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {project.screenshots.map((url, idx) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt=""
                    className="w-full rounded-2xl border border-border object-cover bg-muted"
                    referrerPolicy="no-referrer"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setScreenshotIndex(idx);
                      setShowScreenshots(true);
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="text-foreground font-semibold text-lg">Creator</div>
          <div className="text-sm text-muted-foreground">
            <div>
              <span className="text-muted-foreground">Name:</span>{" "}
              <span className="text-foreground font-semibold">{initial.creator.name}</span>
            </div>
            <div className="mt-1">
              <span className="text-muted-foreground">Email:</span>{" "}
              <span className="text-foreground font-mono">{initial.creator.email || "—"}</span>
            </div>
            <div className="mt-1">
              <span className="text-muted-foreground">Slack:</span>{" "}
              <span className="text-foreground font-mono">{initial.creator.slackId || "—"}</span>
            </div>
            <div className="mt-1">
              <span className="text-muted-foreground">Verification:</span>{" "}
              <span className="text-foreground font-mono">{initial.creator.verificationStatus || "—"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="text-muted-foreground">
          {project.status === "granted"
            ? "Granted projects are locked for creators."
            : "Granting will lock this project for the creator."}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStatus("granted")}
            disabled={busy || !canGrant}
            className="inline-flex items-center justify-center bg-carnival-blue/20 hover:bg-carnival-blue/30 disabled:bg-carnival-blue/10 disabled:cursor-not-allowed text-foreground px-5 py-3 rounded-full font-semibold transition-colors border border-border"
          >
            Grant
          </button>
          <button
            type="button"
            onClick={() => setStatus("shipped")}
            disabled={busy || !canUngrant}
            className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 disabled:bg-muted/40 disabled:cursor-not-allowed text-foreground px-5 py-3 rounded-full font-semibold transition-colors border border-border"
          >
            Undo grant
          </button>
          <button
            type="button"
            onClick={onDeleteProject}
            disabled={busy}
            className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-5 py-3 rounded-full font-bold transition-colors"
          >
            Delete project
          </button>
        </div>
      </div>

      <Modal
        open={showReviews}
        onClose={() => setShowReviews(false)}
        title="Review comments"
        description="All review history for this project."
        maxWidth="lg"
      >
        {initial.reviews.length === 0 ? (
          <div className="text-muted-foreground">No reviews yet.</div>
        ) : (
          <div className="space-y-3">
            {initial.reviews.map((r) => (
              <div key={r.id} className="rounded-2xl border border-border bg-muted px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-foreground font-semibold truncate">
                      {r.reviewerName}
                      {r.reviewerEmail ? ` • ${r.reviewerEmail}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {r.decision}
                    </span>
                    {r.approvedHours !== null && r.approvedHours !== undefined ? (
                      <span className="text-xs font-semibold text-foreground">
                        {r.approvedHours}h approved
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="text-foreground mt-3 whitespace-pre-wrap">{r.reviewComment}</div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={showScreenshots}
        onClose={() => setShowScreenshots(false)}
        title={`Screenshots (${screenshots.length > 0 ? screenshotIndex + 1 : 0}/${screenshots.length})`}
        description="Click next/prev to view larger screenshots."
        maxWidth="2xl"
      >
        {activeScreenshot ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setScreenshotIndex((i) => Math.max(0, i - 1))}
                disabled={screenshotIndex <= 0}
                className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 disabled:bg-muted/40 disabled:cursor-not-allowed text-foreground px-4 py-2 rounded-full font-semibold transition-colors border border-border"
              >
                Prev
              </button>
              <a
                href={activeScreenshot}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-carnival-blue hover:underline truncate"
              >
                Open original
              </a>
              <button
                type="button"
                onClick={() => setScreenshotIndex((i) => Math.min(screenshots.length - 1, i + 1))}
                disabled={screenshotIndex >= screenshots.length - 1}
                className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 disabled:bg-muted/40 disabled:cursor-not-allowed text-foreground px-4 py-2 rounded-full font-semibold transition-colors border border-border"
              >
                Next
              </button>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeScreenshot}
              alt=""
              className="w-full max-h-[70vh] object-contain rounded-2xl border border-border bg-muted"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div className="text-muted-foreground">No screenshots.</div>
        )}
      </Modal>
    </div>
  );
}



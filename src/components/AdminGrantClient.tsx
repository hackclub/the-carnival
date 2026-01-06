"use client";

import { useCallback, useMemo, useState } from "react";
import type { ProjectStatus } from "@/db/schema";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import toast from "react-hot-toast";

type GrantProject = {
  id: string;
  name: string;
  description: string;
  hackatimeProjectName: string;
  playableUrl: string;
  codeUrl: string;
  screenshots: string[];
  status: ProjectStatus;
};

type GrantCreator = {
  id: string;
  name: string;
  email: string;
  slackId: string;
  verificationStatus: string;
};

export default function AdminGrantClient({
  initial,
}: {
  initial: { project: GrantProject; creator: GrantCreator };
}) {
  const [project, setProject] = useState(initial.project);
  const [busy, setBusy] = useState(false);

  const canGrant = useMemo(() => project.status === "shipped", [project.status]);
  const canUngrant = useMemo(() => project.status === "granted", [project.status]);

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
          <div className="text-sm text-muted-foreground">
            Hackatime: <span className="font-mono text-foreground">{project.hackatimeProjectName}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <a
              href={project.playableUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-border bg-muted px-4 py-3 hover:bg-muted/70 transition-colors"
            >
              <div className="text-sm text-muted-foreground">Playable</div>
              <div className="text-foreground font-semibold truncate">{project.playableUrl}</div>
            </a>
            <a
              href={project.codeUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-border bg-muted px-4 py-3 hover:bg-muted/70 transition-colors"
            >
              <div className="text-sm text-muted-foreground">Code</div>
              <div className="text-foreground font-semibold truncate">{project.codeUrl}</div>
            </a>
          </div>
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
    </div>
  );
}



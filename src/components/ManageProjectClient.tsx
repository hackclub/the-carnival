"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectEditor, ProjectStatus, ReviewDecision } from "@/db/schema";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import { Modal } from "@/components/ui";
import toast from "react-hot-toast";

const EDITOR_OPTIONS = [
  { value: "vscode", label: "VS Code" },
  { value: "chrome", label: "Chrome" },
  { value: "firefox", label: "Firefox" },
  { value: "figma", label: "Figma" },
  { value: "neovim", label: "Neovim" },
  { value: "gnu-emacs", label: "GNU Emacs" },
  { value: "jupyterlab", label: "JupyterLab" },
  { value: "obsidian", label: "Obsidian" },
  { value: "blender", label: "Blender" },
  { value: "freecad", label: "FreeCAD" },
  { value: "kicad", label: "KiCad" },
  { value: "krita", label: "Krita" },
  { value: "gimp", label: "GIMP" },
  { value: "inkscape", label: "Inkscape" },
  { value: "godot-engine", label: "Godot Engine" },
  { value: "unity", label: "Unity" },
  { value: "other", label: "Other" },
] as const;

export type ManageProjectInitial = {
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
  reviews: Array<{
    id: string;
    decision: ReviewDecision;
    reviewComment: string;
    createdAt: string; // ISO
    reviewerName: string;
    reviewerEmail: string;
  }>;
};

type ApiProject = ManageProjectInitial;

function cleanList(values: string[]) {
  return values.map((v) => v.trim()).filter(Boolean);
}

function cleanStringList(value: unknown) {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .filter((p): p is string => typeof p === "string")
    .map((p) => p.trim())
    .filter(Boolean);
}

export default function ManageProjectClient({ initial }: { initial: ManageProjectInitial }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitStep, setSubmitStep] = useState<0 | 1>(0);
  const [submitting, setSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [checkReadme, setCheckReadme] = useState(false);
  const [checkTested, setCheckTested] = useState(false);
  const [aiUsage, setAiUsage] = useState<boolean | null>(null);
  const [checkGithubPublic, setCheckGithubPublic] = useState(false);
  const [checkDescriptionClear, setCheckDescriptionClear] = useState(false);
  const [checkScreenshotsWorking, setCheckScreenshotsWorking] = useState(false);
  const [checkAddressedRejection, setCheckAddressedRejection] = useState(false);

  const [hackatimeProjects, setHackatimeProjects] = useState<string[] | null>(null);
  const [hackatimeLoading, setHackatimeLoading] = useState(false);
  const [hackatimeError, setHackatimeError] = useState<string | null>(null);

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [editor, setEditor] = useState<ProjectEditor>(initial.editor);
  const [editorOther, setEditorOther] = useState(initial.editorOther);
  const [hackatimeProjectName, setHackatimeProjectName] = useState(initial.hackatimeProjectName);
  const [playableUrl, setPlayableUrl] = useState(initial.playableUrl);
  const [codeUrl, setCodeUrl] = useState(initial.codeUrl);
  const [screenshotUrls, setScreenshotUrls] = useState<string[]>(
    (initial.screenshots?.length ?? 0) > 0 ? initial.screenshots : [""],
  );
  const [status, setStatus] = useState<ProjectStatus>(initial.status);
  const approvedHours = initial.approvedHours;
  const reviews = initial.reviews;

  const isGranted = status === "granted";

  const isInReview = status === "in-review";
  const isShipped = status === "shipped";
  const canDelete = status === "work-in-progress";
  const deleteDisabledReason = isGranted
    ? "Granted projects cannot be deleted."
    : isInReview
      ? "Projects in review cannot be deleted."
      : isShipped
        ? "Shipped projects cannot be deleted."
        : null;

  const latestRejectedReview = useMemo(() => {
    // Reviews are ordered newest-first in the initial payload.
    return reviews.find((r) => r.decision === "rejected") ?? null;
  }, [reviews]);

  const isReReview =
    !isGranted && !isInReview && !isShipped && status === "work-in-progress" && !!latestRejectedReview;

  const screenshots = useMemo(() => cleanList(screenshotUrls), [screenshotUrls]);

  function isValidUrlString(value: string) {
    try {
      const u = new URL(value);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }

  const submitRequirements = useMemo(() => {
    const nameOk = name.trim().length > 0;
    const descriptionOk = description.trim().length > 0;
    const githubOk = codeUrl.trim().length > 0 && isValidUrlString(codeUrl.trim());
    const demoOk = playableUrl.trim().length > 0 && isValidUrlString(playableUrl.trim());
    const hackatimeOk = hackatimeProjectName.trim().length > 0;
    const screenshotsOk = screenshots.length > 0;

    return {
      nameOk,
      descriptionOk,
      githubOk,
      demoOk,
      hackatimeOk,
      screenshotsOk,
      allOk:
        nameOk && descriptionOk && githubOk && demoOk && hackatimeOk && screenshotsOk && editor !== "other"
          ? true
          : nameOk && descriptionOk && githubOk && demoOk && hackatimeOk && screenshotsOk && editor === "other"
            ? editorOther.trim().length > 0
            : false,
    };
  }, [codeUrl, description, editor, editorOther, hackatimeProjectName, name, playableUrl, screenshots]);

  const checklistOk =
    checkReadme &&
    checkTested &&
    aiUsage !== null &&
    checkGithubPublic &&
    checkDescriptionClear &&
    checkScreenshotsWorking;

  const submitConfirmOk = isReReview ? checkAddressedRejection : checklistOk;

  const refreshHackatimeProjects = useCallback(async () => {
    setHackatimeLoading(true);
    setHackatimeError(null);
    try {
      const res = await fetch("/api/hackatime/projects", { method: "GET" });
      const data = (await res.json().catch(() => null)) as
        | { projects?: unknown; error?: unknown }
        | null;

      if (!res.ok) {
        const message = typeof data?.error === "string" ? data.error : "Failed to load.";
        setHackatimeError(message);
        setHackatimeProjects([]);
        setHackatimeLoading(false);
        return;
      }

      setHackatimeProjects(cleanStringList(data?.projects));
      setHackatimeLoading(false);
    } catch {
      setHackatimeError("Failed to load.");
      setHackatimeProjects([]);
      setHackatimeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hackatimeProjects === null && !hackatimeLoading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      refreshHackatimeProjects();
    }
  }, [hackatimeLoading, hackatimeProjects, refreshHackatimeProjects]);

  const addScreenshotField = useCallback(() => {
    setScreenshotUrls((prev) => [...prev, ""]);
  }, []);

  const updateScreenshotField = useCallback((idx: number, value: string) => {
    setScreenshotUrls((prev) => prev.map((v, i) => (i === idx ? value : v)));
  }, []);

  const removeScreenshotField = useCallback((idx: number) => {
    setScreenshotUrls((prev) => {
      if (prev.length <= 1) return [""];
      const next = prev.filter((_, i) => i !== idx);
      return next.length === 0 ? [""] : next;
    });
  }, []);

  const onSave = useCallback(async () => {
    if (isGranted) {
      toast.error("This project has been granted and can no longer be edited.");
      return;
    }
    setSaving(true);
    setError(null);
    setSavedAt(null);

    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim(),
      editor,
      editorOther: editor === "other" ? editorOther.trim() : "",
      hackatimeProjectName: hackatimeProjectName.trim(),
      playableUrl: playableUrl.trim(),
      codeUrl: codeUrl.trim(),
      screenshots: cleanList(screenshotUrls),
    };

    const toastId = toast.loading("Saving…");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(initial.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as
        | { project?: ApiProject; error?: unknown }
        | null;

      if (!res.ok) {
        const message =
          typeof data?.error === "string" ? data.error : "Failed to save changes.";
        setError(message);
        toast.error(message, { id: toastId });
        setSaving(false);
        return;
      }

      const p = data?.project;
      if (p) {
        setName(p.name);
        setDescription(p.description);
        setEditor(p.editor);
        setEditorOther(p.editorOther ?? "");
        setHackatimeProjectName(p.hackatimeProjectName);
        setPlayableUrl(p.playableUrl);
        setCodeUrl(p.codeUrl);
        setScreenshotUrls((p.screenshots?.length ?? 0) > 0 ? p.screenshots : [""]);
        setStatus(p.status);
      }

      setSavedAt(Date.now());
      toast.success("Saved.", { id: toastId });
      setSaving(false);
    } catch {
      setError("Failed to save changes.");
      toast.error("Failed to save changes.", { id: toastId });
      setSaving(false);
    }
  }, [
    codeUrl,
    description,
    editor,
    editorOther,
    hackatimeProjectName,
    initial.id,
    isGranted,
    name,
    playableUrl,
    screenshotUrls,
    status,
  ]);

  const openSubmit = useCallback(() => {
    if (isGranted) return;
    if (isInReview) {
      toast("This project is already in review.");
      return;
    }
    if (isShipped) {
      toast("This project has already been shipped.");
      return;
    }
    // Reset confirmations each time.
    setCheckReadme(false);
    setCheckTested(false);
      setAiUsage(null);
    setCheckGithubPublic(false);
    setCheckDescriptionClear(false);
    setCheckScreenshotsWorking(false);
    setCheckAddressedRejection(false);
    setSubmitStep(0);
    setSubmitOpen(true);
  }, [isGranted, isInReview, isShipped]);

  const closeSubmit = useCallback(() => {
    setSubmitOpen(false);
    setSubmitStep(0);
    setSubmitting(false);
    setCheckAddressedRejection(false);
  }, []);

  const openDeleteConfirm = useCallback(() => {
    if (!canDelete) {
      if (deleteDisabledReason) toast(deleteDisabledReason);
      return;
    }
    setDeleteOpen(true);
  }, [canDelete, deleteDisabledReason]);

  const closeDeleteConfirm = useCallback(() => {
    if (deleting) return;
    setDeleteOpen(false);
  }, [deleting]);

  const onSubmitForReview = useCallback(async () => {
    if (isGranted) return;
    if (!submitRequirements.allOk) {
      toast.error("Please complete all required fields before submitting.");
      setSubmitStep(0);
      return;
    }
    if (isReReview) {
      if (!checkAddressedRejection) {
        toast.error("Please confirm you've addressed the requested changes before re-submitting.");
        setSubmitStep(1);
        return;
      }
    } else {
      if (!checklistOk) {
        toast.error("Please check all items before submitting.");
        setSubmitStep(1);
        return;
      }
    }
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim(),
      editor,
      editorOther: editor === "other" ? editorOther.trim() : "",
      hackatimeProjectName: hackatimeProjectName.trim(),
      playableUrl: playableUrl.trim(),
      codeUrl: codeUrl.trim(),
      screenshots: cleanList(screenshotUrls),
      status: "in-review",
    };

    const toastId = toast.loading("Submitting for review…");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(initial.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as
        | { project?: ApiProject; error?: unknown }
        | null;

      if (!res.ok) {
        const message =
          typeof data?.error === "string" ? data.error : "Failed to submit for review.";
        toast.error(message, { id: toastId });
        setSubmitting(false);
        return;
      }

      const p = data?.project;
      if (p) {
        setName(p.name);
        setDescription(p.description);
        setEditor(p.editor);
        setEditorOther(p.editorOther ?? "");
        setHackatimeProjectName(p.hackatimeProjectName);
        setPlayableUrl(p.playableUrl);
        setCodeUrl(p.codeUrl);
        setScreenshotUrls((p.screenshots?.length ?? 0) > 0 ? p.screenshots : [""]);
        setStatus(p.status);
      }

      toast.success("Submitted for review.", { id: toastId });
      setSubmitting(false);
      closeSubmit();
    } catch {
      toast.error("Failed to submit for review.", { id: toastId });
      setSubmitting(false);
    }
  }, [
    checkAddressedRejection,
    checklistOk,
    isReReview,
    closeSubmit,
    codeUrl,
    description,
    editor,
    editorOther,
    hackatimeProjectName,
    initial.id,
    isGranted,
    name,
    playableUrl,
    screenshotUrls,
    submitRequirements.allOk,
  ]);

  const onDeleteProject = useCallback(async () => {
    if (!canDelete) return;
    setDeleting(true);
    const toastId = toast.loading("Deleting project…");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(initial.id)}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
      if (!res.ok) {
        const message = typeof data?.error === "string" ? data.error : "Failed to delete project.";
        toast.error(message, { id: toastId });
        setDeleting(false);
        return;
      }

      toast.success("Project deleted.", { id: toastId });
      setDeleteOpen(false);
      window.location.href = "/projects";
    } catch {
      toast.error("Failed to delete project.", { id: toastId });
      setDeleting(false);
    }
  }, [canDelete, initial.id]);

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-foreground font-bold text-2xl truncate">{name || "Project"}</div>
            <div className="text-muted-foreground mt-1">Manage your project details and status.</div>
            {approvedHours !== null && approvedHours !== undefined ? (
              <div className="text-sm text-muted-foreground mt-2">
                Approved hours: <span className="text-foreground font-semibold">{approvedHours}h</span>
              </div>
            ) : null}
          </div>
          <ProjectStatusBadge status={status} />
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="text-foreground font-semibold text-lg">Status</div>
        {isGranted ? (
          <div className="text-sm text-muted-foreground">This project has been granted. Editing is locked.</div>
        ) : isInReview ? (
          <div className="text-sm text-muted-foreground">
            Submitted for review. You’ll see reviewer comments below.
          </div>
        ) : isShipped ? (
          <div className="text-sm text-muted-foreground">
            Shipped! If you need to make changes, ask a reviewer/admin first.
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              When you’re ready, submit for review. You’ll need to fill all required fields and complete the checklist.
            </div>
            <button
              type="button"
              onClick={openSubmit}
              className="inline-flex items-center justify-center bg-carnival-blue hover:bg-carnival-blue/80 disabled:bg-carnival-blue/50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-full font-bold transition-colors"
              disabled={saving}
            >
              {isReReview ? "Submit for re-review" : "Submit for review"}
            </button>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="text-foreground font-semibold text-lg">Reviewer comments</div>
        {reviews.length === 0 ? (
          <div className="text-muted-foreground">No comments yet.</div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
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
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {r.decision}
                  </span>
                </div>
                <div className="text-foreground mt-3 whitespace-pre-wrap">{r.reviewComment}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
        <div className="text-foreground font-semibold text-lg">Project details</div>

        <fieldset disabled={saving || isGranted} className={isGranted ? "opacity-60" : ""}>
        <label className="block">
          <div className="text-sm text-muted-foreground font-medium mb-2">Editor / app</div>
          <select
            value={editor}
            onChange={(e) => setEditor(e.target.value as ProjectEditor)}
            className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
          >
            {EDITOR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {editor === "other" ? (
          <label className="block">
            <div className="text-sm text-muted-foreground font-medium mb-2">
              Other editor name
            </div>
            <input
              value={editorOther}
              onChange={(e) => setEditorOther(e.target.value)}
              required
              className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
              placeholder="e.g. JetBrains, Sublime, ..."
            />
          </label>
        ) : null}

        <label className="block">
          <div className="text-sm text-muted-foreground font-medium mb-2">Project name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
            placeholder="My awesome game"
          />
        </label>

        <label className="block">
          <div className="text-sm text-muted-foreground font-medium mb-2">Hackatime project name</div>
          <div className="space-y-2">
            <select
              value={hackatimeProjectName}
              onChange={(e) => setHackatimeProjectName(e.target.value)}
              className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
              disabled={hackatimeLoading || (hackatimeProjects?.length ?? 0) === 0}
            >
              <option value="">Select a Hackatime project</option>
              {hackatimeProjects?.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <div>Fetched from your Hackatime account.</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHackatimeProjectName("")}
                  className="font-semibold hover:text-foreground hover:underline disabled:opacity-60"
                  disabled={!hackatimeProjectName}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={refreshHackatimeProjects}
                  disabled={hackatimeLoading}
                  className="font-semibold text-carnival-blue hover:underline disabled:opacity-60 disabled:hover:no-underline"
                >
                  {hackatimeLoading ? "Loading…" : "Refresh"}
                </button>
              </div>
            </div>
            {hackatimeError ? (
              <div className="text-sm text-red-200">Couldn’t load projects: {hackatimeError}</div>
            ) : null}
            {!hackatimeLoading && (hackatimeProjects?.length ?? 0) === 0 ? (
              <div className="text-sm text-muted-foreground">
                No projects found. If you just started tracking, Hackatime may need a little time to sync.
              </div>
            ) : null}
          </div>
        </label>

        <label className="block">
          <div className="text-sm text-muted-foreground font-medium mb-2">Description</div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
            placeholder="What are you building?"
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-sm text-muted-foreground font-medium mb-2">Demo video URL</div>
            <input
              value={playableUrl}
              onChange={(e) => setPlayableUrl(e.target.value)}
              className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
              placeholder="https://youtu.be/... or https://..."
            />
          </label>

          <label className="block">
            <div className="text-sm text-muted-foreground font-medium mb-2">Code URL</div>
            <input
              value={codeUrl}
              onChange={(e) => setCodeUrl(e.target.value)}
              className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
              placeholder="https://github.com/me/mygame"
            />
          </label>
        </div>

        <label className="block">
          <div className="text-sm text-muted-foreground font-medium mb-2">
            Screenshots
          </div>
          <div className="space-y-3">
            {screenshotUrls.map((value, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  value={value}
                  onChange={(e) => updateScreenshotField(idx, e.target.value)}
                  className="flex-1 bg-background border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
                  placeholder="https://..."
                />
                <button
                  type="button"
                  onClick={() => removeScreenshotField(idx)}
                  className="h-12 px-4 rounded-2xl bg-muted hover:bg-muted/70 border border-border text-foreground font-semibold disabled:opacity-60"
                  disabled={screenshotUrls.length <= 1}
                  aria-label="Remove screenshot"
                  title="Remove"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addScreenshotField}
              className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 text-foreground px-4 py-2 rounded-full font-semibold transition-colors border border-border"
            >
              Add screenshot
            </button>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Upload screenshots in <span className="text-foreground">#cdn</span> on Slack, then paste the image URLs here. Include screenshots of your{" "}
            <span className="text-foreground">project working</span>, not your code.
          </div>
        </label>
        </fieldset>

        {error ? (
          <div className="rounded-2xl border border-carnival-red/40 bg-carnival-red/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-4 pt-2">
          <div className="text-sm text-muted-foreground">
            {savedAt ? `Saved just now` : null}
          </div>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || isGranted}
            className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-full font-bold transition-colors"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="text-foreground font-semibold text-lg">Delete project</div>
            <div className="text-sm text-muted-foreground">
              Remove this project and its review history. This is only available while the project is work-in-progress.
            </div>
            {!canDelete ? (
              <div className="text-xs text-muted-foreground">
                {deleteDisabledReason ?? "Deletion is not available for this status."}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={openDeleteConfirm}
            disabled={!canDelete}
            className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-full font-bold transition-colors"
          >
            Delete project
          </button>
        </div>
      </div>

      <Modal
        open={submitOpen}
        onClose={closeSubmit}
        title={
          submitStep === 0 ? (isReReview ? "Submit for re-review" : "Submit for review") : isReReview ? "Confirm changes addressed" : "Final checklist"
        }
        description={
          submitStep === 0
            ? "First, make sure the required fields are filled."
            : isReReview
              ? "Confirm you've addressed the most recent reviewer feedback before re-submitting."
              : "Confirm each item before submitting your project for review."
        }
        maxWidth="lg"
      >
        {submitStep === 0 ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-muted px-4 py-4 text-sm text-muted-foreground">
              You can’t submit until these are set: GitHub URL, demo video URL, Hackatime project name, and at least one screenshot.
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between border border-border bg-background rounded-xl px-3 py-2">
                <div className="text-foreground">GitHub URL</div>
                <div
                  className={[
                    "px-2 py-0.5 rounded-md font-bold",
                    submitRequirements.githubOk
                      ? "text-emerald-300 bg-emerald-500/15"
                      : "text-rose-300 bg-rose-500/15",
                  ].join(" ")}
                >
                  {submitRequirements.githubOk ? "Set" : "Missing/invalid"}
                </div>
              </div>
              <div className="flex items-center justify-between border border-border bg-background rounded-xl px-3 py-2">
                <div className="text-foreground">Demo video URL</div>
                <div
                  className={[
                    "px-2 py-0.5 rounded-md font-bold",
                    submitRequirements.demoOk
                      ? "text-emerald-300 bg-emerald-500/15"
                      : "text-rose-300 bg-rose-500/15",
                  ].join(" ")}
                >
                  {submitRequirements.demoOk ? "Set" : "Missing/invalid"}
                </div>
              </div>
              <div className="flex items-center justify-between border border-border bg-background rounded-xl px-3 py-2">
                <div className="text-foreground">Hackatime project name</div>
                <div
                  className={[
                    "px-2 py-0.5 rounded-md font-bold",
                    submitRequirements.hackatimeOk
                      ? "text-emerald-300 bg-emerald-500/15"
                      : "text-rose-300 bg-rose-500/15",
                  ].join(" ")}
                >
                  {submitRequirements.hackatimeOk ? "Set" : "Missing"}
                </div>
              </div>
              <div className="flex items-center justify-between border border-border bg-background rounded-xl px-3 py-2">
                <div className="text-foreground">Screenshots</div>
                <div
                  className={[
                    "px-2 py-0.5 rounded-md font-bold",
                    submitRequirements.screenshotsOk
                      ? "text-emerald-300 bg-emerald-500/15"
                      : "text-rose-300 bg-rose-500/15",
                  ].join(" ")}
                >
                  {submitRequirements.screenshotsOk ? "Set" : "Missing"}
                </div>
              </div>
              {editor === "other" ? (
                <div className="flex items-center justify-between border border-border bg-background rounded-xl px-3 py-2">
                  <div className="text-foreground">Other editor name</div>
                  <div
                    className={[
                      "px-2 py-0.5 rounded-md font-bold",
                      editorOther.trim().length > 0
                        ? "text-emerald-300 bg-emerald-500/15"
                        : "text-rose-300 bg-rose-500/15",
                    ].join(" ")}
                  >
                    {editorOther.trim().length > 0 ? "Set" : "Missing"}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeSubmit}
                className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 text-foreground px-5 py-2.5 rounded-full font-semibold transition-colors border border-border"
                disabled={submitting}
              >
                Not yet
              </button>
              <button
                type="button"
                onClick={() => setSubmitStep(1)}
                className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-full font-bold transition-colors"
                disabled={!submitRequirements.allOk || submitting}
              >
                Continue
              </button>
            </div>
          </div>
        ) : (
          isReReview ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-muted px-4 py-4">
                <div className="text-sm text-foreground font-semibold">Most recent rejection feedback</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {latestRejectedReview
                    ? `${latestRejectedReview.reviewerName} • ${new Date(latestRejectedReview.createdAt).toLocaleString()}`
                    : "No rejection feedback found."}
                </div>
                <div className="text-sm text-foreground mt-3 whitespace-pre-wrap">
                  {latestRejectedReview?.reviewComment ?? "—"}
                </div>
              </div>

              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={checkAddressedRejection}
                  onChange={(e) => setCheckAddressedRejection(e.target.checked)}
                  className="mt-1"
                />
                <div>
                  <div className="text-foreground font-semibold">
                    I have addressed the changes requested in the rejection feedback above
                  </div>
                  <div className="text-sm text-muted-foreground">
                    If you haven’t, close this and iterate until it’s ready.
                  </div>
                </div>
              </label>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSubmitStep(0)}
                  className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 text-foreground px-5 py-2.5 rounded-full font-semibold transition-colors border border-border"
                  disabled={submitting}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={onSubmitForReview}
                  className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-full font-bold transition-colors"
                  disabled={!submitRequirements.allOk || !checkAddressedRejection || submitting}
                >
                  {submitting ? "Submitting…" : "Submit for re-review"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-start gap-3">
                  <input type="checkbox" checked={checkReadme} onChange={(e) => setCheckReadme(e.target.checked)} className="mt-1" />
                  <div>
                    <div className="text-foreground font-semibold">My README contains instructions to build and/or run my extension</div>
                    <div className="text-sm text-muted-foreground">Reviewers should be able to follow it and reproduce.</div>
                  </div>
                </label>
                <label className="flex items-start gap-3">
                  <input type="checkbox" checked={checkTested} onChange={(e) => setCheckTested(e.target.checked)} className="mt-1" />
                  <div>
                    <div className="text-foreground font-semibold">I have tested my extension/plugin and it works without breaking</div>
                    <div className="text-sm text-muted-foreground">You’re confident it’s stable enough for review.</div>
                  </div>
                </label>
                <div className="mt-1">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={aiUsage === true}
                      onChange={(e) => setAiUsage(e.target.checked)}
                      className="mt-1"
                    />
                    <div>
                      <div className="text-foreground font-semibold">Did you use AI while building this?</div>
                      <div className="text-sm text-muted-foreground">AI is fine to use if you’re transparent about it.</div>
                    </div>
                  </label>
                  {aiUsage === null ? (
                    <div className="text-xs text-amber-400 mt-1 pl-7">Please confirm by ticking or leaving it unchecked.</div>
                  ) : null}
                </div>
                <label className="flex items-start gap-3">
                  <input type="checkbox" checked={checkGithubPublic} onChange={(e) => setCheckGithubPublic(e.target.checked)} className="mt-1" />
                  <div>
                    <div className="text-foreground font-semibold">The GitHub URL is publicly accessible for reviewers</div>
                    <div className="text-sm text-muted-foreground">Private repos can’t be reviewed.</div>
                  </div>
                </label>
                <label className="flex items-start gap-3">
                  <input type="checkbox" checked={checkDescriptionClear} onChange={(e) => setCheckDescriptionClear(e.target.checked)} className="mt-1" />
                  <div>
                    <div className="text-foreground font-semibold">The description clearly explains what the project is and what it does</div>
                    <div className="text-sm text-muted-foreground">Make it easy to understand quickly.</div>
                  </div>
                </label>
                <label className="flex items-start gap-3">
                  <input type="checkbox" checked={checkScreenshotsWorking} onChange={(e) => setCheckScreenshotsWorking(e.target.checked)} className="mt-1" />
                  <div>
                    <div className="text-foreground font-semibold">I included screenshots of my project working (not my code)</div>
                    <div className="text-sm text-muted-foreground">Screenshots should show the extension/plugin in action.</div>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSubmitStep(0)}
                  className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 text-foreground px-5 py-2.5 rounded-full font-semibold transition-colors border border-border"
                  disabled={submitting}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={onSubmitForReview}
                  className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-full font-bold transition-colors"
                  disabled={!submitRequirements.allOk || !checklistOk || submitting}
                >
                  {submitting ? "Submitting…" : "Submit for review"}
                </button>
              </div>
            </div>
          )
        )}
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={closeDeleteConfirm}
        title="Delete project"
        description="This cannot be undone."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-carnival-red/40 bg-carnival-red/10 px-4 py-3 text-sm text-red-200">
            Deleting will permanently remove this project and any review comments. You can only delete while work-in-progress.
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeDeleteConfirm}
              disabled={deleting}
              className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 text-foreground px-5 py-2.5 rounded-full font-semibold transition-colors border border-border"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onDeleteProject}
              disabled={deleting}
              className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-full font-bold transition-colors"
            >
              {deleting ? "Deleting…" : "Delete project"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}



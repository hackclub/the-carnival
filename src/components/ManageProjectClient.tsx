"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { ProjectEditor, ProjectStatus, ReviewDecision } from "@/db/schema";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
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

function splitLines(value: string) {
  return value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function joinLines(values: string[]) {
  return values.filter(Boolean).join("\n");
}

function cleanStringList(value: unknown) {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .filter((p): p is string => typeof p === "string")
    .map((p) => p.trim())
    .filter(Boolean);
}

const STATUS_OPTIONS: Array<{
  value: "work-in-progress" | "shipped";
  label: string;
  helper: string;
}> = [
  { value: "work-in-progress", label: "Work in progress", helper: "Still building and iterating." },
  { value: "shipped", label: "Shipped", helper: "Submit for review. A reviewer will approve or request changes." },
];

export default function ManageProjectClient({ initial }: { initial: ManageProjectInitial }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const hackatimeDetailsRef = useRef<HTMLDetailsElement | null>(null);
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
  const [screenshotsText, setScreenshotsText] = useState(joinLines(initial.screenshots));
  const [status, setStatus] = useState<ProjectStatus>(initial.status);
  const reviews = initial.reviews;

  const [statusChoice, setStatusChoice] = useState<"work-in-progress" | "shipped">(() => {
    return initial.status === "work-in-progress" ? "work-in-progress" : "shipped";
  });

  const isGranted = status === "granted";

  const displayStatus = useMemo<ProjectStatus>(() => {
    if (status === "granted") return "granted";
    if (statusChoice === "work-in-progress") return "work-in-progress";
    if (status === "shipped") return "shipped";
    // “Shipped” from the creator UI means “submit for review”.
    return "in-review";
  }, [status, statusChoice]);

  const onHackatimeToggle = useCallback(
    async (e: React.SyntheticEvent<HTMLDetailsElement>) => {
      const isOpen = (e.currentTarget as HTMLDetailsElement).open;
      if (!isOpen) return;
      if (hackatimeProjects !== null || hackatimeLoading) return;

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
    },
    [hackatimeLoading, hackatimeProjects],
  );

  const pickHackatimeProject = useCallback((name: string) => {
    setHackatimeProjectName(name);
    hackatimeDetailsRef.current?.removeAttribute("open");
  }, []);

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

  const onSave = useCallback(async () => {
    if (isGranted) {
      toast.error("This project has been granted and can no longer be edited.");
      return;
    }
    setSaving(true);
    setError(null);
    setSavedAt(null);

    const desiredStatus: ProjectStatus | null =
      statusChoice === "work-in-progress"
        ? "work-in-progress"
        : status === "shipped"
          ? null // already shipped (approved) — don't let creators set shipped directly
          : "in-review";

    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim(),
      editor,
      editorOther: editor === "other" ? editorOther.trim() : "",
      hackatimeProjectName: hackatimeProjectName.trim(),
      playableUrl: playableUrl.trim(),
      codeUrl: codeUrl.trim(),
      screenshots: splitLines(screenshotsText),
    };
    if (desiredStatus) payload.status = desiredStatus;

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
        setScreenshotsText(joinLines(p.screenshots ?? []));
        setStatus(p.status);
      setStatusChoice(p.status === "work-in-progress" ? "work-in-progress" : "shipped");
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
    screenshotsText,
    status,
    statusChoice,
  ]);

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-foreground font-bold text-2xl truncate">{name || "Project"}</div>
            <div className="text-muted-foreground mt-1">Manage your project details and status.</div>
          </div>
          <ProjectStatusBadge status={displayStatus} />
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="text-foreground font-semibold text-lg">Status</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {STATUS_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={[
                "rounded-2xl border p-4 cursor-pointer transition-colors",
                statusChoice === opt.value
                  ? "border-carnival-blue/50 bg-carnival-blue/10"
                  : "border-border bg-muted",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="status"
                  value={opt.value}
                  checked={statusChoice === opt.value}
                  onChange={() => setStatusChoice(opt.value)}
                  className="mt-1"
                />
                <div className="min-w-0">
                  <div className="text-foreground font-semibold">{opt.label}</div>
                  <div className="text-sm text-muted-foreground">{opt.helper}</div>
                </div>
              </div>
            </label>
          ))}
        </div>

        {isGranted ? (
          <div className="text-sm text-muted-foreground">
            This project has been granted. Editing is locked.
          </div>
        ) : displayStatus === "in-review" ? (
          <div className="text-sm text-muted-foreground">
            Submitted for review. You’ll see reviewer comments below.
          </div>
        ) : null}
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
          <div className="space-y-3">
            <input
              value={hackatimeProjectName}
              onChange={(e) => setHackatimeProjectName(e.target.value)}
              className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
              placeholder="Pick from your Hackatime projects"
            />

            <details
              ref={hackatimeDetailsRef}
              className="rounded-2xl border border-border bg-muted overflow-hidden"
              onToggle={onHackatimeToggle}
            >
              <summary className="cursor-pointer select-none px-4 py-3 text-sm text-foreground flex items-center justify-between">
                <span>Browse Hackatime projects</span>
                <span className="text-carnival-blue">▼</span>
              </summary>
              <div className="border-t border-border px-4 py-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    This list is fetched from your Hackatime account.
                  </div>
                  <button
                    type="button"
                    onClick={refreshHackatimeProjects}
                    disabled={hackatimeLoading}
                    className="text-xs font-semibold text-carnival-blue hover:underline disabled:opacity-60 disabled:hover:no-underline"
                  >
                    Refresh
                  </button>
                </div>

                {hackatimeLoading ? (
                  <div className="text-sm text-muted-foreground">Loading…</div>
                ) : hackatimeError ? (
                  <div className="text-sm text-red-200">
                    Couldn’t load projects: {hackatimeError}
                  </div>
                ) : (hackatimeProjects?.length ?? 0) === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No projects found. (If you just started tracking, Hackatime may need a bit
                    of data.)
                  </div>
                ) : (
                  <div className="max-h-56 overflow-auto space-y-2">
                    {hackatimeProjects!.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => pickHackatimeProject(p)}
                        className="w-full text-left px-3 py-2 rounded-xl bg-background hover:bg-muted border border-border text-sm text-foreground"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </details>
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
            <div className="text-sm text-muted-foreground font-medium mb-2">Playable URL</div>
            <input
              value={playableUrl}
              onChange={(e) => setPlayableUrl(e.target.value)}
              className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
              placeholder="https://mygame.vercel.app"
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
            Screenshots <span className="font-normal">(one URL per line)</span>
          </div>
          <textarea
            value={screenshotsText}
            onChange={(e) => setScreenshotsText(e.target.value)}
            rows={4}
            className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
            placeholder={`https://...\nhttps://...`}
          />
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
    </div>
  );
}



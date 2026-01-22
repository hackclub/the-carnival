"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { R2ImageUpload } from "@/components/R2ImageUpload";

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

type CreateProjectPayload = {
  name: string;
  description: string;
  editor: string;
  editorOther: string;
  hackatimeProjectName: string;
  playableUrl: string;
  codeUrl: string;
  screenshots: string[];
};

function cleanString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export default function CreateProjectModal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const hackatimeDetailsRef = useRef<HTMLDetailsElement | null>(null);

  const { data: sessionData } = useSession();
  type SessionUser = { slackId?: string | null };
  const slackId = (sessionData as { user?: SessionUser } | null | undefined)?.user?.slackId ?? null;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hackatimeProjects, setHackatimeProjects] = useState<string[] | null>(null);
  const [hackatimeLoading, setHackatimeLoading] = useState(false);
  const [hackatimeError, setHackatimeError] = useState<string | null>(null);
  const [editor, setEditor] = useState<(typeof EDITOR_OPTIONS)[number]["value"]>("vscode");
  const [screenshotUrls, setScreenshotUrls] = useState<string[]>([""]);

  const shouldBeOpen = useMemo(() => {
    const v = searchParams.get("new");
    return v === "1" || v === "true" || v === "yes";
  }, [searchParams]);

  const clearNewParam = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;

    if (shouldBeOpen) {
      if (!d.open) d.showModal();
      document.body.style.overflow = "hidden";
    } else {
      if (d.open) d.close();
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [shouldBeOpen]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;

    const onClose = () => {
      setIsSubmitting(false);
      setError(null);
      setScreenshotUrls([""]);
      clearNewParam();
    };

    d.addEventListener("close", onClose);
    return () => d.removeEventListener("close", onClose);
  }, [clearNewParam]);

  const onBackdropClick = useCallback((e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.close();
    }
  }, []);

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      setIsSubmitting(true);

      const fd = new FormData(e.currentTarget);
      const name = cleanString(fd.get("name"));
      const description = cleanString(fd.get("description"));
      const editorValue = cleanString(fd.get("editor"));
      const editorOther = cleanString(fd.get("editorOther"));
      const hackatimeProjectName = cleanString(fd.get("hackatimeProjectName"));
      const playableUrl = cleanString(fd.get("playableUrl"));
      const codeUrl = cleanString(fd.get("codeUrl"));
      const screenshots = screenshotUrls.map((s) => s.trim()).filter(Boolean);

      const payload: CreateProjectPayload = {
        name,
        description,
        editor: editorValue,
        editorOther,
        hackatimeProjectName,
        playableUrl,
        codeUrl,
        screenshots,
      };

      try {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = (await res.json().catch(() => null)) as
          | { id?: string; error?: string }
          | null;

        if (!res.ok) {
          setError(data?.error || "Failed to create project.");
          setIsSubmitting(false);
          return;
        }

        // Close modal (this also clears the URL param via the `close` event listener).
        dialogRef.current?.close();
        router.refresh();
      } catch {
        setError("Failed to create project.");
        setIsSubmitting(false);
      }
    },
    [router, screenshotUrls],
  );

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

  const onHackatimeToggle = useCallback(
    async (e: React.SyntheticEvent<HTMLDetailsElement>) => {
      const isOpen = (e.currentTarget as HTMLDetailsElement).open;
      if (!isOpen) return;
      if (hackatimeProjects !== null || hackatimeLoading) return;

      setHackatimeLoading(true);
      setHackatimeError(null);
      try {
        const url = slackId
          ? `/api/hackatime/projects?slackId=${encodeURIComponent(slackId)}`
          : "/api/hackatime/projects";
        const res = await fetch(url, { method: "GET" });
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

        const raw = Array.isArray(data?.projects) ? data?.projects : [];
        const projects = raw
          .filter((p): p is string => typeof p === "string")
          .map((p) => p.trim())
          .filter(Boolean);

        setHackatimeProjects(projects);
        setHackatimeLoading(false);
      } catch {
        setHackatimeError("Failed to load.");
        setHackatimeProjects([]);
        setHackatimeLoading(false);
      }
    },
    [hackatimeLoading, hackatimeProjects, slackId],
  );

  const pickHackatimeProject = useCallback((name: string) => {
    const input = document.querySelector(
      'input[name="hackatimeProjectName"]',
    ) as HTMLInputElement | null;
    if (input) input.value = name;
    hackatimeDetailsRef.current?.removeAttribute("open");
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="carnival-dialog m-auto w-[min(720px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] rounded-3xl bg-card/95 backdrop-blur border border-border text-foreground p-0 overflow-hidden"
      onClick={onBackdropClick}
      aria-label="Create a new project"
    >
      <div className="flex flex-col max-h-[calc(100vh-2rem)]">
        <div className="px-6 md:px-8 py-6 border-b border-border">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xl md:text-2xl font-bold">Create a project</div>
              <div className="text-muted-foreground mt-1">
                Fill in your project details. You can edit later.
              </div>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="h-10 w-10 rounded-full bg-muted hover:bg-muted/70 border border-border text-foreground flex items-center justify-center"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="flex-1 px-6 md:px-8 py-6 space-y-5 overflow-y-auto"
        >
          {error ? (
            <div className="rounded-2xl border border-carnival-red/40 bg-carnival-red/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="rounded-2xl border border-border bg-muted px-4 py-4 text-sm text-foreground">
            <div className="font-semibold">Before you create a project</div>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-muted-foreground">
              <li>
                Your project should be <span className="text-foreground">unique</span> — not a
                remake of an existing extension. If it’s your first extension/plugin, bring your
                own changes/ideas.
              </li>
              <li>
                It should not just be a <span className="text-foreground">wrapper around an API</span>.
                Build something interesting.
              </li>
              <li>
                <span className="text-foreground">Simple plugins</span> are generally not acceptable.
              </li>
              <li>
                <span className="text-foreground">Fraud or Hackatime manipulation</span> will result
                in a ban from participating in a YSWS.
              </li>
            </ul>
          </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-sm text-muted-foreground font-medium mb-2">
              Editor / app <span className="font-normal">(optional)</span>
            </div>
            <select
              name="editor"
              value={editor}
              onChange={(e) => setEditor(e.target.value as (typeof EDITOR_OPTIONS)[number]["value"])}
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
                name="editorOther"
                required
                className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
                placeholder="e.g. JetBrains, Sublime, ..."
              />
            </label>
          ) : (
            <input type="hidden" name="editorOther" value="" />
          )}

          <label className="block">
            <div className="text-sm text-muted-foreground font-medium mb-2">
              Project name
            </div>
            <input
              name="name"
              required
              autoFocus
              className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
              placeholder="My awesome game"
            />
          </label>

          <label className="block">
            <div className="text-sm text-muted-foreground font-medium mb-2">
              Hackatime project name
              <span className="text-muted-foreground font-normal"> (optional)</span>
            </div>
            <div className="space-y-3">
              <input
                name="hackatimeProjectName"
                readOnly
                className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
                placeholder="Pick from the list below (or add later)"
              />
              <div className="text-xs text-muted-foreground">
                You can’t type here — choose a project from the dropdown below.
              </div>

              <details
                ref={hackatimeDetailsRef}
                className="rounded-2xl border border-border bg-muted overflow-hidden"
                onToggle={onHackatimeToggle}
              >
                <summary className="cursor-pointer select-none px-4 py-3 text-sm text-foreground flex items-center justify-between">
                  <span>Browse Hackatime projects</span>
                  <span className="text-carnival-blue">▼</span>
                </summary>
                <div className="border-t border-border px-4 py-3">
                  {hackatimeLoading ? (
                    <div className="text-sm text-muted-foreground">Loading…</div>
                  ) : hackatimeError ? (
                    <div className="text-sm text-red-200">
                      Couldn’t load projects: {hackatimeError}
                    </div>
                  ) : (hackatimeProjects?.length ?? 0) === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No projects found. (If you just started tracking, Hackatime may
                      need a bit of data.)
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
        </div>

        <label className="block">
          <div className="text-sm text-muted-foreground font-medium mb-2">
            Description
          </div>
          <textarea
            name="description"
            required
            rows={4}
            className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
            placeholder="What are you building? What’s fun about it?"
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-sm text-muted-foreground font-medium mb-2">
              Demo video URL <span className="font-normal">(optional)</span>
            </div>
            <input
              name="playableUrl"
              className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
              placeholder="https://youtu.be/... or https://..."
            />
          </label>

          <label className="block">
            <div className="text-sm text-muted-foreground font-medium mb-2">GitHub URL</div>
            <input
              name="codeUrl"
              required
              className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
              placeholder="https://github.com/me/mygame"
            />
          </label>
        </div>

        <label className="block">
          <div className="text-sm text-muted-foreground font-medium mb-2">
            Screenshots
            <span className="text-muted-foreground font-normal"> (optional)</span>
          </div>
          <div className="space-y-3">
            {screenshotUrls.map((value, idx) => (
              <div key={idx} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground font-medium">Screenshot {idx + 1}</div>
                  <button
                    type="button"
                    onClick={() => removeScreenshotField(idx)}
                    className="h-10 px-4 rounded-full bg-muted hover:bg-muted/70 border border-border text-foreground font-semibold disabled:opacity-60"
                    disabled={screenshotUrls.length <= 1}
                    aria-label="Remove screenshot"
                    title="Remove"
                  >
                    Remove
                  </button>
                </div>

                <R2ImageUpload
                  label="Upload"
                  value={value}
                  onChange={(url) => updateScreenshotField(idx, url)}
                  kind="project_screenshot"
                  disabled={isSubmitting}
                  helperText="Include screenshots of your project working (not your code)."
                />
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
        </label>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 text-foreground px-5 py-3 rounded-full font-semibold transition-colors border border-border"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-full font-bold transition-colors"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating…" : "Create project"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}



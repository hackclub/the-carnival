"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  EDITOR_OPTIONS,
  cleanString,
  type EditorOptionValue,
} from "@/lib/project-form-utils";

type CreateProjectPayload = {
  name: string;
  description: string;
  editor: string;
  editorOther: string;
  bountyProjectId?: string;
};

export default function CreateProjectModal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorOptionValue>("vscode");
  const [editorOther, setEditorOther] = useState("");
  const [bountyProjectId, setBountyProjectId] = useState("");
  const [availableBounties, setAvailableBounties] = useState<
    Array<{ id: string; name: string; prizeUsd: number }>
  >([]);
  const [bountiesLoading, setBountiesLoading] = useState(false);
  const bountiesLoadedRef = useRef(false);

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

      if (!bountiesLoadedRef.current) {
        bountiesLoadedRef.current = true;
        setBountiesLoading(true);
        fetch("/api/bounties")
          .then((r) => r.json())
          .then((data) => {
            const projects = Array.isArray(data?.projects)
              ? data.projects
              : [];
            setAvailableBounties(
              projects
                .filter(
                  (p: { completed?: boolean; status?: string }) =>
                    !p.completed && p.status === "approved",
                )
                .map((p: { id: string; name: string; prizeUsd: number }) => ({
                  id: p.id,
                  name: p.name,
                  prizeUsd: p.prizeUsd,
                })),
            );
          })
          .catch(() => {})
          .finally(() => setBountiesLoading(false));
      }
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
      setEditor("vscode");
      setEditorOther("");
      setBountyProjectId("");
      clearNewParam();
    };

    d.addEventListener("close", onClose);
    return () => d.removeEventListener("close", onClose);
  }, [clearNewParam]);

  const onBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === e.currentTarget) {
        e.currentTarget.close();
      }
    },
    [],
  );

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      setIsSubmitting(true);

      const fd = new FormData(e.currentTarget);
      const name = cleanString(fd.get("name"));
      const description = cleanString(fd.get("description"));

      if (!name) {
        setError("Project name is required.");
        setIsSubmitting(false);
        return;
      }
      if (!description) {
        setError("Description is required.");
        setIsSubmitting(false);
        return;
      }

      const payload: CreateProjectPayload = {
        name,
        description,
        editor,
        editorOther: editor === "other" ? editorOther.trim() : "",
        ...(bountyProjectId ? { bountyProjectId } : {}),
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

        dialogRef.current?.close();
        if (data?.id) {
          router.push(`/projects/${data.id}`);
        } else {
          router.refresh();
        }
      } catch {
        setError("Failed to create project.");
        setIsSubmitting(false);
      }
    },
    [editor, editorOther, bountyProjectId, router],
  );

  const editorLabel =
    EDITOR_OPTIONS.find((o) => o.value === editor)?.label ?? "Select editor";

  return (
    <dialog
      ref={dialogRef}
      className="carnival-dialog m-auto w-[min(520px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] rounded-[var(--radius-2xl)] bg-card/95 backdrop-blur border border-border text-foreground p-0 overflow-hidden"
      onClick={onBackdropClick}
      aria-label="Create a new project"
    >
      <div className="flex flex-col max-h-[calc(100vh-2rem)]">
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-bold">New project</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                You can fill in the rest from the project dashboard.
              </div>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="h-9 w-9 rounded-[var(--radius-xl)] bg-muted hover:bg-muted/70 border border-border text-foreground flex items-center justify-center text-sm"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="flex-1 px-6 py-5 space-y-4 overflow-y-auto"
        >
          {error ? (
            <div className="rounded-[var(--radius-xl)] border border-carnival-red/40 bg-carnival-red/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <label className="block">
            <div className="text-sm text-muted-foreground font-medium mb-1.5">
              Project name
            </div>
            <input
              name="name"
              required
              autoFocus
              className="w-full bg-background border border-border rounded-[var(--radius-xl)] px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
              placeholder="My awesome extension"
            />
          </label>

          <label className="block">
            <div className="text-sm text-muted-foreground font-medium mb-1.5">
              Description
            </div>
            <textarea
              name="description"
              required
              rows={3}
              className="w-full bg-background border border-border rounded-[var(--radius-xl)] px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40 resize-none"
              placeholder="What are you building? What's fun about it?"
            />
          </label>

          <div>
            <div className="text-sm text-muted-foreground font-medium mb-1.5">
              Editor / app
            </div>
            {/* Native select to avoid portal-in-dialog issues */}
            <select
              value={editor}
              onChange={(e) =>
                setEditor(e.target.value as EditorOptionValue)
              }
              className="w-full bg-background border border-border rounded-[var(--radius-xl)] px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40 appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%237b240a' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: "right 0.75rem center",
                backgroundRepeat: "no-repeat",
                backgroundSize: "1.25em 1.25em",
              }}
            >
              {EDITOR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {editor === "other" ? (
            <label className="block">
              <div className="text-sm text-muted-foreground font-medium mb-1.5">
                Other editor name
              </div>
              <input
                value={editorOther}
                onChange={(e) => setEditorOther(e.target.value)}
                required
                className="w-full bg-background border border-border rounded-[var(--radius-xl)] px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
                placeholder="e.g. JetBrains, Sublime, ..."
              />
            </label>
          ) : null}

          <div>
            <div className="text-sm text-muted-foreground font-medium mb-1.5">
              Bounty{" "}
              <span className="font-normal text-muted-foreground/70">
                (optional)
              </span>
            </div>
            {bountiesLoading ? (
              <div className="text-sm text-muted-foreground py-2">
                Loading bounties...
              </div>
            ) : (
              <select
                value={bountyProjectId}
                onChange={(e) => setBountyProjectId(e.target.value)}
                className="w-full bg-background border border-border rounded-[var(--radius-xl)] px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40 appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%237b240a' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: "right 0.75rem center",
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "1.25em 1.25em",
                }}
              >
                <option value="">None</option>
                {availableBounties.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} (${b.prizeUsd})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 text-foreground px-5 py-2.5 rounded-[var(--radius-xl)] font-semibold transition-colors border border-border text-sm"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-[var(--radius-xl)] font-bold transition-colors text-sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create project"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { R2ImageUpload } from "@/components/R2ImageUpload";
import { parseConsideredHackatimeRange } from "@/lib/hackatime-range";
import { MIN_CREATOR_ORIGINALITY_RATIONALE_LENGTH } from "@/lib/project-originality";
import { useHackatimeRangePreview } from "@/hooks/useHackatimeRangePreview";
import {
  EDITOR_OPTIONS,
  appendCsvToken,
  cleanString,
  formatHoursMinutes,
  toDateInputValue,
  toHoursMinutes,
  type EditorOptionValue,
  type HackatimeProjectOption,
} from "@/lib/project-form-utils";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MIN_SCREENSHOTS = 3;

type CreateProjectPayload = {
  name: string;
  description: string;
  editor: string;
  editorOther: string;
  category: string;
  tags: string;
  hackatimeProjectName: string;
  hackatimeStartedAt: string | null;
  hackatimeStoppedAt: string | null;
  hackatimeTotalSeconds: number | null;
  videoUrl: string;
  playableDemoUrl: string;
  codeUrl: string;
  screenshots: string[];
  creatorDeclaredOriginality: boolean;
  creatorDuplicateExplanation: string;
  creatorOriginalityRationale: string;
  consideredHackatimeRange?: {
    startDate: string;
    endDate: string;
  };
};

type HackatimePreview = {
  hackatimeStartedAt: string | null;
  hackatimeStoppedAt: string | null;
  hackatimeTotalSeconds: number | null;
  hackatimeHours: { hours: number; minutes: number } | null;
};

function toLocalDateTime(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function CreateProjectModal({
  categorySuggestions = [],
  tagSuggestions = [],
}: {
  categorySuggestions?: string[];
  tagSuggestions?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const hackatimeDetailsRef = useRef<HTMLDetailsElement | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hackatimeProjects, setHackatimeProjects] = useState<HackatimeProjectOption[] | null>(null);
  const [hackatimeLoading, setHackatimeLoading] = useState(false);
  const [hackatimeError, setHackatimeError] = useState<string | null>(null);
  const [hackatimeConnectUrl, setHackatimeConnectUrl] = useState<string | null>(null);
  const [selectedHackatime, setSelectedHackatime] = useState<HackatimeProjectOption | null>(null);
  const [hackatimeProjectName, setHackatimeProjectName] = useState("");
  const [consideredRangeStartDate, setConsideredRangeStartDate] = useState("");
  const [consideredRangeEndDate, setConsideredRangeEndDate] = useState("");
  const [editor, setEditor] = useState<EditorOptionValue>("vscode");
  const [category, setCategory] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [screenshotUrls, setScreenshotUrls] = useState<string[]>(
    Array.from({ length: MIN_SCREENSHOTS }, () => ""),
  );
  const [originalityDeclaration, setOriginalityDeclaration] = useState<"" | "original" | "overlap">("");
  const [duplicateExplanation, setDuplicateExplanation] = useState("");
  const [originalityRationale, setOriginalityRationale] = useState("");
  const [bountyProjectId, setBountyProjectId] = useState("");
  const [availableBounties, setAvailableBounties] = useState<Array<{ id: string; name: string; prizeUsd: number }>>([]);
  const bountiesLoadingRef = useRef(false);

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

      if (availableBounties.length === 0 && !bountiesLoadingRef.current) {
        bountiesLoadingRef.current = true;
        fetch("/api/bounties")
          .then((r) => r.json())
          .then((data) => {
            const projects = Array.isArray(data?.projects) ? data.projects : [];
            setAvailableBounties(
              projects
                .filter((p: { completed?: boolean; status?: string }) => !p.completed && p.status === "approved")
                .map((p: { id: string; name: string; prizeUsd: number }) => ({
                  id: p.id,
                  name: p.name,
                  prizeUsd: p.prizeUsd,
                })),
            );
          })
          .catch(() => {})
          .finally(() => {
            bountiesLoadingRef.current = false;
          });
      }
    } else {
      if (d.open) d.close();
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [shouldBeOpen, availableBounties.length]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;

    const onClose = () => {
      setIsSubmitting(false);
      setError(null);
      setCategory("");
      setTagsInput("");
      setScreenshotUrls(Array.from({ length: MIN_SCREENSHOTS }, () => ""));
      setOriginalityDeclaration("");
      setDuplicateExplanation("");
      setOriginalityRationale("");
      setSelectedHackatime(null);
      setHackatimeProjectName("");
      setConsideredRangeStartDate("");
      setConsideredRangeEndDate("");
      setBountyProjectId("");
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

  const consideredHackatimeRange = useMemo(
    () =>
      parseConsideredHackatimeRange({
        startDate: consideredRangeStartDate,
        endDate: consideredRangeEndDate,
      }),
    [consideredRangeEndDate, consideredRangeStartDate],
  );

  const selectedHackatimePreview = useMemo<HackatimePreview | null>(() => {
    if (!selectedHackatime || !consideredHackatimeRange.ok) return null;
    const selectedDefaultStartDate = toDateInputValue(selectedHackatime?.startedAt ?? null);
    const selectedDefaultEndDate = toDateInputValue(selectedHackatime?.stoppedAt ?? null);
    return selectedHackatime.name === hackatimeProjectName &&
      selectedDefaultStartDate === consideredHackatimeRange.value.startDate &&
      selectedDefaultEndDate === consideredHackatimeRange.value.endDate
      ? {
        hackatimeStartedAt: selectedHackatime.startedAt,
        hackatimeStoppedAt: selectedHackatime.stoppedAt,
        hackatimeTotalSeconds: selectedHackatime.totalSeconds,
        hackatimeHours: toHoursMinutes(selectedHackatime.totalSeconds),
      }
      : null;
  }, [consideredHackatimeRange, hackatimeProjectName, selectedHackatime]);

  const { preview: hackatimePreview, loading: hackatimePreviewLoading, error: hackatimePreviewError } =
    useHackatimeRangePreview({
      enabled: !!hackatimeProjectName,
      endpoint: "/api/hackatime/projects/preview",
      body:
        hackatimeProjectName && consideredHackatimeRange.ok
          ? { hackatimeProjectName, consideredHackatimeRange: consideredHackatimeRange.value }
          : null,
      rangeError:
        hackatimeProjectName && !consideredHackatimeRange.ok && (consideredRangeStartDate || consideredRangeEndDate)
          ? consideredHackatimeRange.error
          : null,
      localPreview: selectedHackatimePreview,
    });

  const hackatimeHoursLabel = useMemo(() => {
    if (!hackatimePreview?.hackatimeHours) return "—";
    return formatHoursMinutes(hackatimePreview.hackatimeHours.hours, hackatimePreview.hackatimeHours.minutes);
  }, [hackatimePreview]);

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
      const categoryValue = cleanString(fd.get("category"));
      const tagsValue = cleanString(fd.get("tags"));
      const videoUrl = cleanString(fd.get("videoUrl"));
      const playableDemoUrl = cleanString(fd.get("playableDemoUrl"));
      const codeUrl = cleanString(fd.get("codeUrl"));
      const screenshots = screenshotUrls.map((s) => s.trim()).filter(Boolean);
      const originalityDeclarationValue = cleanString(fd.get("originalityDeclaration"));
      const creatorDuplicateExplanation = cleanString(fd.get("creatorDuplicateExplanation"));
      const creatorOriginalityRationale = cleanString(fd.get("creatorOriginalityRationale"));

      if (screenshots.length < MIN_SCREENSHOTS) {
        setError(`Please upload at least ${MIN_SCREENSHOTS} screenshots.`);
        setIsSubmitting(false);
        return;
      }
      if (
        originalityDeclarationValue !== "original" &&
        originalityDeclarationValue !== "overlap"
      ) {
        setError("Please declare whether your project overlaps with existing submissions.");
        setIsSubmitting(false);
        return;
      }
      if (
        originalityDeclarationValue === "original" &&
        (creatorDuplicateExplanation || creatorOriginalityRationale)
      ) {
        setError("Clear overlap details when declaring your project as fully original.");
        setIsSubmitting(false);
        return;
      }
      if (
        originalityDeclarationValue === "overlap" &&
        creatorOriginalityRationale.length < MIN_CREATOR_ORIGINALITY_RATIONALE_LENGTH
      ) {
        setError(
          `Please explain what makes your project different in at least ${MIN_CREATOR_ORIGINALITY_RATIONALE_LENGTH} characters.`,
        );
        setIsSubmitting(false);
        return;
      }
      if (hackatimeProjectName && !consideredHackatimeRange.ok) {
        setError(consideredHackatimeRange.error);
        setIsSubmitting(false);
        return;
      }

      const payload: CreateProjectPayload & { bountyProjectId?: string } = {
        name,
        description,
        editor: editorValue,
        editorOther,
        category: categoryValue,
        tags: tagsValue,
        hackatimeProjectName,
        hackatimeStartedAt: hackatimePreview?.hackatimeStartedAt ?? null,
        hackatimeStoppedAt: hackatimePreview?.hackatimeStoppedAt ?? null,
        hackatimeTotalSeconds: hackatimePreview?.hackatimeTotalSeconds ?? null,
        videoUrl,
        playableDemoUrl,
        codeUrl,
        screenshots,
        creatorDeclaredOriginality: originalityDeclarationValue === "original",
        creatorDuplicateExplanation:
          originalityDeclarationValue === "overlap" ? creatorDuplicateExplanation : "",
        creatorOriginalityRationale:
          originalityDeclarationValue === "overlap" ? creatorOriginalityRationale : "",
        consideredHackatimeRange:
          hackatimeProjectName && consideredHackatimeRange.ok
            ? consideredHackatimeRange.value
            : undefined,
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

        // Close modal (this also clears the URL param via the `close` event listener).
        dialogRef.current?.close();
        router.refresh();
      } catch {
        setError("Failed to create project.");
        setIsSubmitting(false);
      }
    },
    [
      consideredHackatimeRange,
      bountyProjectId,
      hackatimePreview,
      hackatimeProjectName,
      router,
      screenshotUrls,
    ],
  );

  const addScreenshotField = useCallback(() => {
    setScreenshotUrls((prev) => [...prev, ""]);
  }, []);

  const updateScreenshotField = useCallback((idx: number, value: string) => {
    setScreenshotUrls((prev) => prev.map((v, i) => (i === idx ? value : v)));
  }, []);

  const removeScreenshotField = useCallback((idx: number) => {
    setScreenshotUrls((prev) => {
      if (prev.length <= MIN_SCREENSHOTS) return prev;
      const next = prev.filter((_, i) => i !== idx);
      return next.length < MIN_SCREENSHOTS ? prev : next;
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
        const returnTo = (() => {
          const qs = searchParams.toString();
          return qs ? `${pathname}?${qs}` : pathname;
        })();
        const res = await fetch(
          `/api/hackatime/projects?returnTo=${encodeURIComponent(returnTo)}`,
          { method: "GET" },
        );
        const data = (await res.json().catch(() => null)) as
          | { projects?: unknown; error?: unknown; code?: unknown; connectUrl?: unknown }
          | null;

        if (!res.ok) {
          const code = typeof data?.code === "string" ? data.code : "";
          const connectUrl =
            typeof data?.connectUrl === "string" && data.connectUrl.trim()
              ? data.connectUrl
              : null;
          if (code === "oauth_required") {
            const qs = searchParams.toString();
            const returnTo = qs ? `${pathname}?${qs}` : pathname;
            setHackatimeConnectUrl(
              connectUrl ??
                `/api/hackatime/oauth/start?returnTo=${encodeURIComponent(returnTo)}`,
            );
          }
          const message = typeof data?.error === "string" ? data.error : "Failed to load.";
          setHackatimeError(message);
          setHackatimeProjects(null);
          setHackatimeLoading(false);
          return;
        }

        const raw = Array.isArray(data?.projects) ? data.projects : [];
        const projects = raw
          .map((p) => {
            if (!p || typeof p !== "object") return null;
            const row = p as {
              name?: unknown;
              startedAt?: unknown;
              stoppedAt?: unknown;
              totalSeconds?: unknown;
            };
            const name = typeof row.name === "string" ? row.name.trim() : "";
            if (!name) return null;
            const totalSeconds =
              typeof row.totalSeconds === "number" && Number.isFinite(row.totalSeconds)
                ? Math.max(0, Math.floor(row.totalSeconds))
                : 0;
            return {
              name,
              startedAt: typeof row.startedAt === "string" ? row.startedAt : null,
              stoppedAt: typeof row.stoppedAt === "string" ? row.stoppedAt : null,
              totalSeconds,
            } satisfies HackatimeProjectOption;
          })
          .filter((p): p is HackatimeProjectOption => !!p);

        setHackatimeProjects(projects);
        setHackatimeConnectUrl(null);
        setHackatimeLoading(false);
      } catch {
        setHackatimeError("Failed to load.");
        setHackatimeProjects(null);
        setHackatimeLoading(false);
      }
    },
    [hackatimeLoading, hackatimeProjects, pathname, searchParams],
  );

  const pickHackatimeProject = useCallback((project: HackatimeProjectOption) => {
    setSelectedHackatime(project);
    setHackatimeProjectName(project.name);
    setConsideredRangeStartDate(toDateInputValue(project.startedAt));
    setConsideredRangeEndDate(toDateInputValue(project.stoppedAt));
    hackatimeDetailsRef.current?.removeAttribute("open");
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="carnival-dialog m-auto w-[min(720px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] rounded-[var(--radius-2xl)] bg-card/95 backdrop-blur border border-border text-foreground p-0 overflow-hidden"
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
              className="h-10 w-10 rounded-[var(--radius-xl)] bg-muted hover:bg-muted/70 border border-border text-foreground flex items-center justify-center"
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
            <div className="rounded-[var(--radius-2xl)] border border-carnival-red/40 bg-carnival-red/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="rounded-[var(--radius-2xl)] border-2 border-[var(--carnival-border)] bg-muted px-4 py-4 text-sm text-foreground">
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

          <div className="platform-surface-card px-4 py-4 space-y-3">
            <div className="text-sm font-semibold text-foreground">Originality declaration</div>
            <div className="text-xs text-muted-foreground">
              Confirm whether your project overlaps with prior submissions. If it does, explain what
              makes this one meaningfully different.
            </div>
            <div className="space-y-2">
              <label className="flex items-start gap-3 rounded-[var(--radius-xl)]  border-2 border-[var(--carnival-border)] bg-background px-3 py-2">
                <input
                  type="radio"
                  name="originalityDeclaration"
                  value="original"
                  checked={originalityDeclaration === "original"}
                  onChange={() => {
                    setOriginalityDeclaration("original");
                    setDuplicateExplanation("");
                    setOriginalityRationale("");
                  }}
                  className="mt-0.5 h-4 w-4 accent-carnival-blue"
                />
                <span className="text-sm text-foreground">
                  I checked existing submissions and this project does not overlap.
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-[var(--radius-xl)]  border-2 border-[var(--carnival-border)] bg-background px-3 py-2">
                <input
                  type="radio"
                  name="originalityDeclaration"
                  value="overlap"
                  checked={originalityDeclaration === "overlap"}
                  onChange={() => setOriginalityDeclaration("overlap")}
                  className="mt-0.5 h-4 w-4 accent-carnival-blue"
                />
                <span className="text-sm text-foreground">
                  I found overlap with existing work and I’ll explain the differences.
                </span>
              </label>
            </div>

            {originalityDeclaration === "overlap" ? (
              <div className="space-y-3">
                <label className="block">
                  <div className="text-sm text-muted-foreground font-medium mb-2">
                    Overlap details <span className="font-normal">(optional)</span>
                  </div>
                  <textarea
                    name="creatorDuplicateExplanation"
                    value={duplicateExplanation}
                    onChange={(e) => setDuplicateExplanation(e.target.value)}
                    rows={2}
                    className="w-full bg-background border border-border rounded-[var(--radius-2xl)] px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
                    placeholder="What existing project(s) are similar?"
                  />
                </label>
                <label className="block">
                  <div className="text-sm text-muted-foreground font-medium mb-2">
                    Uniqueness rationale
                  </div>
                  <textarea
                    name="creatorOriginalityRationale"
                    value={originalityRationale}
                    onChange={(e) => setOriginalityRationale(e.target.value)}
                    rows={3}
                    className="w-full bg-background border border-border rounded-[var(--radius-2xl)] px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
                    placeholder="Describe what is new/different in your implementation."
                  />
                  <div className="mt-2 text-xs text-muted-foreground">
                    Minimum {MIN_CREATOR_ORIGINALITY_RATIONALE_LENGTH} characters. Current:{" "}
                    {originalityRationale.trim().length}
                  </div>
                </label>
              </div>
            ) : (
              <>
                <input type="hidden" name="creatorDuplicateExplanation" value="" />
                <input type="hidden" name="creatorOriginalityRationale" value="" />
              </>
            )}
          </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-sm text-muted-foreground font-medium mb-2">
              Editor / app <span className="font-normal">(optional)</span>
            </div>
            <input type="hidden" name="editor" value={editor} />
            <Select value={editor} onValueChange={(v) => { if (v) setEditor(v as EditorOptionValue); }}>
              <SelectTrigger className="w-full h-11 rounded-[var(--radius-2xl)] border-border bg-background px-4 text-foreground">
                <SelectValue placeholder="Select editor" />
              </SelectTrigger>
              <SelectContent>
                {EDITOR_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          {editor === "other" ? (
            <label className="block">
              <div className="text-sm text-muted-foreground font-medium mb-2">
                Other editor name
              </div>
              <input
                name="editorOther"
                required
                className="w-full bg-background border border-border rounded-[var(--radius-2xl)] px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
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
              className="w-full bg-background border border-border rounded-[var(--radius-2xl)] px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
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
                value={hackatimeProjectName}
                className="w-full bg-background border border-border rounded-[var(--radius-2xl)] px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
                placeholder="Pick from the list below (or add later)"
              />
              <input type="hidden" name="hackatimeStartedAt" value={hackatimePreview?.hackatimeStartedAt ?? ""} />
              <input type="hidden" name="hackatimeStoppedAt" value={hackatimePreview?.hackatimeStoppedAt ?? ""} />
              <input
                type="hidden"
                name="hackatimeTotalSeconds"
                value={
                  typeof hackatimePreview?.hackatimeTotalSeconds === "number"
                    ? String(hackatimePreview.hackatimeTotalSeconds)
                    : ""
                }
              />
              <div className="text-xs text-muted-foreground">
                You can’t type here — choose a project from the dropdown below.
              </div>
              {hackatimeProjectName ? (
                <div className="rounded-[var(--radius-xl)]  border-2 border-[var(--carnival-border)] bg-muted px-3 py-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <div className="text-xs text-muted-foreground mb-1">Considered start date</div>
                      <DatePicker value={consideredRangeStartDate} onChange={(v) => setConsideredRangeStartDate(v)} />
                    </label>
                    <label className="block">
                      <div className="text-xs text-muted-foreground mb-1">Considered end date</div>
                      <DatePicker value={consideredRangeEndDate} onChange={(v) => setConsideredRangeEndDate(v)} />
                    </label>
                  </div>
                  {!consideredHackatimeRange.ok ? (
                    <div className="text-xs text-red-200">{consideredHackatimeRange.error}</div>
                  ) : null}
                  <div className="text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Considered Hackatime hours:{" "}
                      <span className="text-foreground font-semibold">{hackatimeHoursLabel}</span>
                    </span>
                    {hackatimePreviewLoading ? (
                      <span>Refreshing…</span>
                    ) : null}
                  </div>
                  {hackatimePreviewError ? (
                    <div className="text-xs text-red-200">{hackatimePreviewError}</div>
                  ) : null}
                  <div className="text-xs text-muted-foreground">
                    Started: {toLocalDateTime(hackatimePreview?.hackatimeStartedAt ?? null)} • Stopped:{" "}
                    {toLocalDateTime(hackatimePreview?.hackatimeStoppedAt ?? null)}
                  </div>
                </div>
              ) : null}

              <details
                ref={hackatimeDetailsRef}
                className="rounded-[var(--radius-2xl)] border-2 border-[var(--carnival-border)] bg-muted overflow-hidden"
                onToggle={onHackatimeToggle}
              >
                <summary className="cursor-pointer select-none px-4 py-3 text-sm text-foreground flex items-center justify-between">
                  <span>Browse Hackatime projects</span>
                  <span className="text-carnival-blue">▼</span>
                </summary>
                <div className="border-t border-border px-4 py-3">
                  {hackatimeLoading ? (
                    <div className="text-sm text-muted-foreground">Loading…</div>
                  ) : hackatimeConnectUrl ? (
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">
                        Connect your Hackatime account to load projects.
                      </div>
                      <a
                        href={hackatimeConnectUrl}
                        className="inline-flex items-center justify-center bg-carnival-blue hover:bg-carnival-blue/80 text-white px-4 py-2 rounded-[var(--radius-xl)] font-semibold transition-colors"
                      >
                        Connect Hackatime
                      </a>
                    </div>
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
                          key={p.name}
                          type="button"
                          onClick={() => pickHackatimeProject(p)}
                          className="w-full text-left px-3 py-2 rounded-[var(--radius-xl)] bg-background hover:bg-muted border border-border text-sm text-foreground"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            </div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-sm text-muted-foreground font-medium mb-2">
              Category
            </div>
            <input
              name="category"
              list="create-project-category-suggestions"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-background border border-border rounded-[var(--radius-2xl)] px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
              placeholder="e.g. Productivity, Game Dev"
            />
            <datalist id="create-project-category-suggestions">
              {categorySuggestions.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
            <div className="mt-2 text-xs text-muted-foreground">
              Pick an existing category or create a new one.
            </div>
          </label>

          <label className="block">
            <div className="text-sm text-muted-foreground font-medium mb-2">
              Tags <span className="font-normal">(comma-separated)</span>
            </div>
            <input
              name="tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full bg-background border border-border rounded-[var(--radius-2xl)] px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
              placeholder="e.g. ai, web, multiplayer"
            />
            {tagSuggestions.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {tagSuggestions.slice(0, 8).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setTagsInput((prev) => appendCsvToken(prev, tag))}
                    className="rounded-[var(--carnival-squircle-radius)] border-2 border-[var(--carnival-border)] bg-muted px-2.5 py-1 text-xs text-foreground hover:bg-muted/70 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            ) : null}
          </label>
        </div>

        {availableBounties.length > 0 ? (
          <div className="block">
            <div className="text-sm text-muted-foreground font-medium mb-2">
              Link to a bounty <span className="font-normal">(optional)</span>
            </div>
            <Select
              value={bountyProjectId || "__none__"}
              onValueChange={(v) => setBountyProjectId(v === "__none__" || !v ? "" : v)}
            >
              <SelectTrigger className="w-full h-11 rounded-[var(--radius-2xl)] border-border bg-background px-4 text-foreground">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {availableBounties.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} (${b.prizeUsd})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="mt-2 text-xs text-muted-foreground">
              Attach a bounty to claim when this project gets granted.
            </div>
          </div>
        ) : null}

        <label className="block">
          <div className="text-sm text-muted-foreground font-medium mb-2">
            Description
          </div>
          <textarea
            name="description"
            required
            rows={4}
            className="w-full bg-background border border-border rounded-[var(--radius-2xl)] px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
            placeholder="What are you building? What’s fun about it?"
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-sm text-muted-foreground font-medium mb-2">
              Video link
            </div>
            <input
              name="videoUrl"
              required
              className="w-full bg-background border border-border rounded-[var(--radius-2xl)] px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
              placeholder="https://youtu.be/... or https://..."
            />
          </label>

          <label className="block">
            <div className="text-sm text-muted-foreground font-medium mb-2">
              Playable demo link
            </div>
            <input
              name="playableDemoUrl"
              required
              className="w-full bg-background border border-border rounded-[var(--radius-2xl)] px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
              placeholder="https://mygame.example.com or https://itch.io/..."
            />
          </label>

          <label className="block">
            <div className="text-sm text-muted-foreground font-medium mb-2">GitHub URL</div>
            <input
              name="codeUrl"
              required
              className="w-full bg-background border border-border rounded-[var(--radius-2xl)] px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
              placeholder="https://github.com/me/mygame"
            />
          </label>
        </div>

        <label className="block">
          <div className="text-sm text-muted-foreground font-medium mb-2">
            Screenshots
            <span className="text-muted-foreground font-normal"> (minimum {MIN_SCREENSHOTS})</span>
          </div>
          <div className="space-y-3">
            {screenshotUrls.map((value, idx) => (
              <div key={idx} className="platform-surface-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground font-medium">Screenshot {idx + 1}</div>
                  <button
                    type="button"
                    onClick={() => removeScreenshotField(idx)}
                    className="h-10 px-4 rounded-[var(--radius-xl)] bg-muted hover:bg-muted/70 border border-border text-foreground font-semibold disabled:opacity-60"
                    disabled={screenshotUrls.length <= MIN_SCREENSHOTS}
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
              className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 text-foreground px-4 py-2 rounded-[var(--radius-xl)] font-semibold transition-colors border border-border"
            >
              Add screenshot
            </button>
          </div>
        </label>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 text-foreground px-5 py-3 rounded-[var(--radius-xl)] font-semibold transition-colors border border-border"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-[var(--radius-xl)] font-bold transition-colors"
              disabled={isSubmitting || !!hackatimeProjectName && !consideredHackatimeRange.ok}
            >
              {isSubmitting ? "Creating…" : "Create project"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

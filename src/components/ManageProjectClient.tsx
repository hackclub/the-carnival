"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ProjectEditor,
  ProjectStatus,
  ProjectSubmissionChecklist,
  ReviewDecision,
} from "@/db/schema";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import ReviewJustificationSummary from "@/components/ReviewJustificationSummary";
import { Modal } from "@/components/ui";
import { R2ImageUpload } from "@/components/R2ImageUpload";
import { ScreenshotGrid } from "@/components/ScreenshotGrid";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReviewJustificationPayload } from "@/lib/review-rules";
import {
  hasRequiredProjectSubmissionChecklistAnswers,
  normalizeProjectSubmissionChecklist,
  PROJECT_SUBMISSION_CHECKLIST_ITEMS,
} from "@/lib/project-submission-checklist";
import {
  formatConsideredHackatimeRangeLabel,
  getProjectConsideredHackatimeRange,
  parseConsideredHackatimeRange,
} from "@/lib/hackatime-range";
import { useHackatimeRangePreview } from "@/hooks/useHackatimeRangePreview";
import {
  EDITOR_OPTIONS,
  appendCsvToken,
  cleanList,
  formatTotalSeconds,
  toDateInputValue,
  type HackatimeProjectOption,
  type HackatimeRangePreview,
} from "@/lib/project-form-utils";
import toast from "react-hot-toast";

export type ManageProjectInitial = {
  id: string;
  name: string;
  description: string;
  category: string | null;
  tags: string[];
  editor: ProjectEditor;
  editorOther: string;
  hackatimeProjectName: string;
  hackatimeStartedAt: string | null;
  hackatimeStoppedAt: string | null;
  hackatimeTotalSeconds: number | null;
  videoUrl: string;
  playableDemoUrl: string;
  codeUrl: string;
  screenshots: string[];
  submissionChecklist: ProjectSubmissionChecklist | null;
  creatorDeclaredOriginality: boolean;
  creatorDuplicateExplanation: string | null;
  creatorOriginalityRationale: string | null;
  status: ProjectStatus;
  bountyProjectId: string | null;
  approvedHours: number | null;
  resubmissionBlocked: boolean;
  resubmissionBlockedReason: string | null;
  reviews: Array<{
    id: string;
    decision: ReviewDecision;
    reviewComment: string;
    reviewJustification: ReviewJustificationPayload | null;
    createdAt: string; // ISO
    reviewerName: string;
    reviewerEmail: string;
  }>;
};

type ApiProject = ManageProjectInitial;
export default function ManageProjectClient({
  initial,
  categorySuggestions = [],
  tagSuggestions = [],
}: {
  initial: ManageProjectInitial;
  categorySuggestions?: string[];
  tagSuggestions?: string[];
}) {
  const initialConsideredRange = getProjectConsideredHackatimeRange({
    hackatimeStartedAt: initial.hackatimeStartedAt,
    hackatimeStoppedAt: initial.hackatimeStoppedAt,
  });
  const initialSubmissionChecklist = normalizeProjectSubmissionChecklist(initial.submissionChecklist);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitStep, setSubmitStep] = useState<0 | 1>(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitRangeStartDate, setSubmitRangeStartDate] = useState(initialConsideredRange?.startDate ?? "");
  const [submitRangeEndDate, setSubmitRangeEndDate] = useState(initialConsideredRange?.endDate ?? "");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [savedSubmissionChecklist, setSavedSubmissionChecklist] = useState<ProjectSubmissionChecklist | null>(
    initial.submissionChecklist ?? null,
  );
  const [checkReadme, setCheckReadme] = useState(initialSubmissionChecklist.readmeInstructions);
  const [checkTested, setCheckTested] = useState(initialSubmissionChecklist.testedWorking);
  const [aiUsage, setAiUsage] = useState(initialSubmissionChecklist.usedAi);
  const [checkGithubPublic, setCheckGithubPublic] = useState(initialSubmissionChecklist.githubPublic);
  const [checkDescriptionClear, setCheckDescriptionClear] = useState(
    initialSubmissionChecklist.descriptionClear,
  );
  const [checkScreenshotsWorking, setCheckScreenshotsWorking] = useState(
    initialSubmissionChecklist.screenshotsWorking,
  );
  const [checkAddressedRejection, setCheckAddressedRejection] = useState(false);

  const [hackatimeProjects, setHackatimeProjects] = useState<HackatimeProjectOption[] | null>(null);
  const [hackatimeLoading, setHackatimeLoading] = useState(false);
  const [hackatimeError, setHackatimeError] = useState<string | null>(null);
  const [hackatimeConnectUrl, setHackatimeConnectUrl] = useState<string | null>(null);

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [category, setCategory] = useState(initial.category ?? "");
  const [tagsInput, setTagsInput] = useState((initial.tags ?? []).join(", "));
  const [editor, setEditor] = useState<ProjectEditor>(initial.editor);
  const [editorOther, setEditorOther] = useState(initial.editorOther);
  const [hackatimeProjectName, setHackatimeProjectName] = useState(initial.hackatimeProjectName);
  const [hackatimeStartedAt, setHackatimeStartedAt] = useState<string | null>(initial.hackatimeStartedAt);
  const [hackatimeStoppedAt, setHackatimeStoppedAt] = useState<string | null>(initial.hackatimeStoppedAt);
  const [hackatimeTotalSeconds, setHackatimeTotalSeconds] = useState<number | null>(
    initial.hackatimeTotalSeconds,
  );
  const [videoUrl, setVideoUrl] = useState(initial.videoUrl);
  const [playableDemoUrl, setPlayableDemoUrl] = useState(initial.playableDemoUrl);
  const [codeUrl, setCodeUrl] = useState(initial.codeUrl);
  const [screenshotUrls, setScreenshotUrls] = useState<string[]>(
    (initial.screenshots?.length ?? 0) > 0 ? initial.screenshots : [""],
  );
  const [status, setStatus] = useState<ProjectStatus>(initial.status);
  const [approvedHours, setApprovedHours] = useState<number | null>(initial.approvedHours);
  const [creatorDeclaredOriginality, setCreatorDeclaredOriginality] = useState<boolean>(
    initial.creatorDeclaredOriginality,
  );
  const [creatorDuplicateExplanation, setCreatorDuplicateExplanation] = useState<string | null>(
    initial.creatorDuplicateExplanation,
  );
  const [creatorOriginalityRationale, setCreatorOriginalityRationale] = useState<string | null>(
    initial.creatorOriginalityRationale,
  );
  const reviews = initial.reviews;
  const [bountyProjectId, setBountyProjectId] = useState<string | null>(initial.bountyProjectId ?? null);
  const [availableBounties, setAvailableBounties] = useState<Array<{ id: string; name: string; prizeUsd: number }>>([]);

  useEffect(() => {
    fetch("/api/bounties")
      .then((r) => r.json())
      .then((data) => {
        const projects = Array.isArray(data?.projects) ? data.projects : [];
        setAvailableBounties(
          projects
            .filter(
              (p: { completed?: boolean; id?: string; status?: string }) =>
                (p.status === "approved" && !p.completed) || p.id === initial.bountyProjectId,
            )
            .map((p: { id: string; name: string; prizeUsd: number }) => ({
              id: p.id,
              name: p.name,
              prizeUsd: p.prizeUsd,
            })),
        );
      })
      .catch(() => {});
  }, [initial.bountyProjectId]);

  const isGranted = status === "granted";

  const isInReview = status === "in-review";
  const isShipped = status === "shipped";
  const isResubmissionBlocked = initial.resubmissionBlocked;
  const resubmissionBlockedReason = initial.resubmissionBlockedReason?.trim() || null;
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
  const submitConsideredRange = useMemo(
    () =>
      parseConsideredHackatimeRange({
        startDate: submitRangeStartDate,
        endDate: submitRangeEndDate,
      }),
    [submitRangeEndDate, submitRangeStartDate],
  );
  const selectedHackatimeProject = useMemo(
    () => (hackatimeProjects ?? []).find((p) => p.name === hackatimeProjectName) ?? null,
    [hackatimeProjectName, hackatimeProjects],
  );
  const selectedHackatimePreview = useMemo<HackatimeRangePreview | null>(() => {
    if (!selectedHackatimeProject || !submitConsideredRange.ok) return null;
    const selectedDefaultStartDate = toDateInputValue(selectedHackatimeProject.startedAt);
    const selectedDefaultEndDate = toDateInputValue(selectedHackatimeProject.stoppedAt);
    return selectedHackatimeProject.name === hackatimeProjectName &&
      selectedDefaultStartDate === submitConsideredRange.value.startDate &&
      selectedDefaultEndDate === submitConsideredRange.value.endDate
      ? {
        hackatimeStartedAt: selectedHackatimeProject.startedAt,
        hackatimeStoppedAt: selectedHackatimeProject.stoppedAt,
        hackatimeTotalSeconds: selectedHackatimeProject.totalSeconds,
        hackatimeHours: null,
      }
      : null;
  }, [hackatimeProjectName, selectedHackatimeProject, submitConsideredRange]);
  const { preview: hackatimePreview, loading: hackatimePreviewLoading, error: hackatimePreviewError } =
    useHackatimeRangePreview({
      enabled: !!hackatimeProjectName.trim(),
      endpoint: "/api/hackatime/projects/preview",
      body:
        hackatimeProjectName.trim() && submitConsideredRange.ok
          ? {
            hackatimeProjectName,
            consideredHackatimeRange: submitConsideredRange.value,
          }
          : null,
      rangeError:
        hackatimeProjectName.trim() && !submitConsideredRange.ok && (submitRangeStartDate || submitRangeEndDate)
          ? submitConsideredRange.error
          : null,
      localPreview: selectedHackatimePreview,
    });
  const effectiveHackatimeStartedAt = hackatimePreview?.hackatimeStartedAt ?? hackatimeStartedAt;
  const effectiveHackatimeStoppedAt = hackatimePreview?.hackatimeStoppedAt ?? hackatimeStoppedAt;
  const effectiveHackatimeTotalSeconds = hackatimePreview?.hackatimeTotalSeconds ?? hackatimeTotalSeconds;
  const currentConsideredRange = useMemo(
    () =>
      getProjectConsideredHackatimeRange({
        hackatimeStartedAt: effectiveHackatimeStartedAt,
        hackatimeStoppedAt: effectiveHackatimeStoppedAt,
      }),
    [effectiveHackatimeStartedAt, effectiveHackatimeStoppedAt],
  );
  const currentConsideredRangeLabel = useMemo(
    () => formatConsideredHackatimeRangeLabel(currentConsideredRange),
    [currentConsideredRange],
  );
  const currentHackatimeHoursLabel = useMemo(
    () => formatTotalSeconds(effectiveHackatimeTotalSeconds),
    [effectiveHackatimeTotalSeconds],
  );

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
    const demoOk = videoUrl.trim().length > 0 && isValidUrlString(videoUrl.trim());
    const playableOk = playableDemoUrl.trim().length > 0 && isValidUrlString(playableDemoUrl.trim());
    const hackatimeOk = hackatimeProjectName.trim().length > 0;
    const screenshotsOk = screenshots.length >= 3;
    const editorOk = editor !== "other" || editorOther.trim().length > 0;
    const declarationOk = creatorDeclaredOriginality || (creatorOriginalityRationale?.trim()?.length ?? 0) > 0;

    return {
      nameOk,
      descriptionOk,
      githubOk,
      demoOk,
      playableOk,
      hackatimeOk,
      screenshotsOk,
      editorOk,
      declarationOk,
      allOk:
        nameOk && descriptionOk && githubOk && demoOk && playableOk &&
        hackatimeOk && screenshotsOk && editorOk && declarationOk,
    };
  }, [codeUrl, description, editor, editorOther, hackatimeProjectName, name, playableDemoUrl, videoUrl, screenshots, creatorDeclaredOriginality, creatorOriginalityRationale]);

  const submissionChecklist = useMemo<ProjectSubmissionChecklist>(
    () => ({
      readmeInstructions: checkReadme,
      testedWorking: checkTested,
      usedAi: aiUsage,
      githubPublic: checkGithubPublic,
      descriptionClear: checkDescriptionClear,
      screenshotsWorking: checkScreenshotsWorking,
    }),
    [aiUsage, checkDescriptionClear, checkGithubPublic, checkReadme, checkScreenshotsWorking, checkTested],
  );

  const checklistOk = useMemo(
    () => hasRequiredProjectSubmissionChecklistAnswers(submissionChecklist),
    [submissionChecklist],
  );
  const setChecklistValue = useCallback(
    (key: keyof ProjectSubmissionChecklist, checked: boolean) => {
      if (key === "readmeInstructions") setCheckReadme(checked);
      else if (key === "testedWorking") setCheckTested(checked);
      else if (key === "usedAi") setAiUsage(checked);
      else if (key === "githubPublic") setCheckGithubPublic(checked);
      else if (key === "descriptionClear") setCheckDescriptionClear(checked);
      else if (key === "screenshotsWorking") setCheckScreenshotsWorking(checked);
    },
    [],
  );

  const refreshHackatimeProjects = useCallback(async () => {
    setHackatimeLoading(true);
    setHackatimeError(null);
    try {
      const returnTo = `${window.location.pathname}${window.location.search}`;
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
          typeof data?.connectUrl === "string" && data.connectUrl.trim() ? data.connectUrl : null;
        if (code === "oauth_required") {
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

  const onSave = async () => {
    if (isGranted) {
      toast.error("This project has been granted and can no longer be edited.");
      return;
    }
    if (hackatimeProjectName.trim() && !submitConsideredRange.ok) {
      setError(submitConsideredRange.error);
      toast.error(submitConsideredRange.error);
      return;
    }
    setSaving(true);
    setError(null);
    setSavedAt(null);

    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim(),
      category: category.trim(),
      tags: tagsInput,
      editor,
      editorOther: editor === "other" ? editorOther.trim() : "",
      hackatimeProjectName: hackatimeProjectName.trim(),
      hackatimeStartedAt: effectiveHackatimeStartedAt,
      hackatimeStoppedAt: effectiveHackatimeStoppedAt,
      hackatimeTotalSeconds: effectiveHackatimeTotalSeconds,
      videoUrl: videoUrl.trim(),
      playableDemoUrl: playableDemoUrl.trim(),
      codeUrl: codeUrl.trim(),
      screenshots: cleanList(screenshotUrls),
      bountyProjectId: bountyProjectId || null,
      consideredHackatimeRange:
        hackatimeProjectName.trim() && submitConsideredRange.ok ? submitConsideredRange.value : undefined,
    };

    const toastId = toast.loading("Saving…");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(initial.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as
        | { project?: ApiProject; notice?: unknown; error?: unknown }
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
        setCategory(p.category ?? "");
        setTagsInput((p.tags ?? []).join(", "));
        setEditor(p.editor);
        setEditorOther(p.editorOther ?? "");
        setHackatimeProjectName(p.hackatimeProjectName);
        setHackatimeStartedAt(p.hackatimeStartedAt ?? null);
        setHackatimeStoppedAt(p.hackatimeStoppedAt ?? null);
        setHackatimeTotalSeconds(
          typeof p.hackatimeTotalSeconds === "number" ? p.hackatimeTotalSeconds : null,
        );
        setVideoUrl(p.videoUrl);
        setPlayableDemoUrl(p.playableDemoUrl);
        setCodeUrl(p.codeUrl);
        setScreenshotUrls((p.screenshots?.length ?? 0) > 0 ? p.screenshots : [""]);
        setSavedSubmissionChecklist(p.submissionChecklist ?? null);
        setCreatorDeclaredOriginality(p.creatorDeclaredOriginality);
        setCreatorDuplicateExplanation(p.creatorDuplicateExplanation ?? null);
        setCreatorOriginalityRationale(p.creatorOriginalityRationale ?? null);
        setStatus(p.status);
        setApprovedHours(p.approvedHours ?? null);
        setSubmitRangeStartDate(toDateInputValue(p.hackatimeStartedAt ?? null));
        setSubmitRangeEndDate(toDateInputValue(p.hackatimeStoppedAt ?? null));
      }

      setSavedAt(Date.now());
      const notice = typeof data?.notice === "string" ? data.notice : null;
      toast.success(notice ?? "Saved.", { id: toastId });
      setSaving(false);
    } catch {
      setError("Failed to save changes.");
      toast.error("Failed to save changes.", { id: toastId });
      setSaving(false);
    }
  };

  const openSubmit = () => {
    if (isGranted) return;
    if (isInReview) {
      toast("This project is already in review.");
      return;
    }
    if (isShipped) {
      toast("This project has already been shipped.");
      return;
    }
    // Rehydrate from the last saved submission state.
    const checklist = normalizeProjectSubmissionChecklist(savedSubmissionChecklist);
    setCheckReadme(checklist.readmeInstructions);
    setCheckTested(checklist.testedWorking);
    setAiUsage(checklist.usedAi);
    setCheckGithubPublic(checklist.githubPublic);
    setCheckDescriptionClear(checklist.descriptionClear);
    setCheckScreenshotsWorking(checklist.screenshotsWorking);
    setCheckAddressedRejection(false);
    setSubmitStep(0);
    setSubmitOpen(true);
  };

  const closeSubmit = () => {
    setSubmitOpen(false);
    setSubmitStep(0);
    setSubmitting(false);
    setCheckAddressedRejection(false);
  };

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

  const onSubmitForReview = async () => {
    if (isGranted) return;
    if (isResubmissionBlocked) {
      toast.error("This project was dismissed by an admin and cannot be submitted for review.");
      return;
    }
    if (!submitRequirements.allOk) {
      toast.error("Please complete all required fields before submitting.");
      setSubmitStep(0);
      return;
    }
    if (!submitConsideredRange.ok) {
      toast.error(submitConsideredRange.error);
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
        toast.error("Please check all required checklist items before submitting.");
        setSubmitStep(1);
        return;
      }
    }
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim(),
      category: category.trim(),
      tags: tagsInput,
      editor,
      editorOther: editor === "other" ? editorOther.trim() : "",
      hackatimeProjectName: hackatimeProjectName.trim(),
      hackatimeStartedAt: effectiveHackatimeStartedAt,
      hackatimeStoppedAt: effectiveHackatimeStoppedAt,
      hackatimeTotalSeconds: effectiveHackatimeTotalSeconds,
      videoUrl: videoUrl.trim(),
      playableDemoUrl: playableDemoUrl.trim(),
      codeUrl: codeUrl.trim(),
      screenshots: cleanList(screenshotUrls),
      bountyProjectId: bountyProjectId || null,
      status: "in-review",
      consideredHackatimeRange: submitConsideredRange.value,
    };
    if (!isReReview) {
      payload.submissionChecklist = submissionChecklist;
    }

    const toastId = toast.loading("Submitting for review…");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(initial.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as
        | { project?: ApiProject; notice?: unknown; error?: unknown; code?: unknown; missing?: unknown }
        | null;

      if (!res.ok) {
        const message =
          typeof data?.error === "string" ? data.error : "Failed to submit for review.";
        const code = typeof data?.code === "string" ? data.code : null;
        if (code === "missing_profile_address") {
          toast.custom(
            (t) => (
              <div className="platform-surface-card px-4 py-3 shadow-xl max-w-[520px]">
                <div className="text-foreground font-semibold">Shipping address required</div>
                <div className="text-muted-foreground text-sm mt-1">{message}</div>
                <div className="mt-3 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => toast.dismiss(t.id)}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      toast.dismiss(t.id);
                      window.location.href = "/account";
                    }}
                    className="bg-carnival-red hover:bg-carnival-red/80 text-white px-4 py-2 rounded-[var(--radius-xl)] font-bold transition-colors text-sm"
                  >
                    Open account settings
                  </button>
                </div>
              </div>
            ),
            { id: toastId, duration: 12000 },
          );
        } else {
          toast.error(message, { id: toastId });
        }
        setSubmitting(false);
        return;
      }

      const p = data?.project;
      if (p) {
        setName(p.name);
        setDescription(p.description);
        setCategory(p.category ?? "");
        setTagsInput((p.tags ?? []).join(", "));
        setEditor(p.editor);
        setEditorOther(p.editorOther ?? "");
        setHackatimeProjectName(p.hackatimeProjectName);
        setHackatimeStartedAt(p.hackatimeStartedAt ?? null);
        setHackatimeStoppedAt(p.hackatimeStoppedAt ?? null);
        setHackatimeTotalSeconds(
          typeof p.hackatimeTotalSeconds === "number" ? p.hackatimeTotalSeconds : null,
        );
        setVideoUrl(p.videoUrl);
        setPlayableDemoUrl(p.playableDemoUrl);
        setCodeUrl(p.codeUrl);
        setScreenshotUrls((p.screenshots?.length ?? 0) > 0 ? p.screenshots : [""]);
        setSavedSubmissionChecklist(p.submissionChecklist ?? null);
        setCreatorDeclaredOriginality(p.creatorDeclaredOriginality);
        setCreatorDuplicateExplanation(p.creatorDuplicateExplanation ?? null);
        setCreatorOriginalityRationale(p.creatorOriginalityRationale ?? null);
        setStatus(p.status);
        setApprovedHours(p.approvedHours ?? null);
        setSubmitRangeStartDate(toDateInputValue(p.hackatimeStartedAt ?? null));
        setSubmitRangeEndDate(toDateInputValue(p.hackatimeStoppedAt ?? null));
      }

      const notice = typeof data?.notice === "string" ? data.notice : null;
      toast.success(notice ?? "Submitted for review.", { id: toastId });
      setSubmitting(false);
      closeSubmit();
    } catch {
      toast.error("Failed to submit for review.", { id: toastId });
      setSubmitting(false);
    }
  };

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
      <div className="platform-surface-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-foreground font-bold text-2xl truncate">{name || "Project"}</div>
            <div className="text-muted-foreground mt-1">Manage your project details and status.</div>
            {approvedHours !== null && approvedHours !== undefined ? (
              <div className="text-sm text-muted-foreground mt-2">
                Approved hours: <span className="text-foreground font-semibold">{approvedHours}h</span>
              </div>
            ) : null}
            {bountyProjectId ? (
              <div className="text-sm text-muted-foreground mt-2">
                Linked bounty:{" "}
                <span className="text-purple-700 dark:text-purple-300 font-semibold">
                  {availableBounties.find((b) => b.id === bountyProjectId)?.name ?? bountyProjectId}
                </span>
              </div>
            ) : null}
          </div>
          <ProjectStatusBadge status={status} />
        </div>
      </div>

      <div className="platform-surface-card p-6 space-y-4">
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
        ) : isResubmissionBlocked ? (
          <div className="rounded-[var(--radius-2xl)] border border-carnival-red/40 bg-carnival-red/10 px-4 py-3 text-sm text-foreground">
            <div className="font-semibold mb-1">This project has been dismissed by an admin.</div>
            {resubmissionBlockedReason ? (
              <div className="mt-2 rounded-[var(--radius-xl)] border border-carnival-red/30 bg-background/40 px-3 py-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Reason from admin
                </div>
                <div className="whitespace-pre-wrap text-foreground">
                  {resubmissionBlockedReason}
                </div>
              </div>
            ) : null}
            <div className="text-muted-foreground mt-2">
              It cannot be submitted for review. If you believe this was a mistake, contact an
              organizer to have it re-enabled.
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              When you’re ready, submit for review. You’ll need to fill all required fields and complete required checklist items.
            </div>
            <button
              type="button"
              onClick={openSubmit}
              className="inline-flex items-center justify-center bg-carnival-blue hover:bg-carnival-blue/80 disabled:bg-carnival-blue/50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-[var(--radius-xl)] font-bold transition-colors"
              disabled={saving}
            >
              {isReReview ? "Submit for re-review" : "Submit for review"}
            </button>
          </div>
        )}
      </div>

      <div className="platform-surface-card p-6 space-y-4">
        <div className="text-foreground font-semibold text-lg">Originality declaration</div>
        <div className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-4 space-y-3">
          <div className="text-sm text-muted-foreground">Creator statement</div>
          <div className="text-foreground font-semibold">
            {creatorDeclaredOriginality
              ? "Declared as fully original (no overlap with existing submissions)."
              : "Declared overlap with existing submissions."}
          </div>
          {!creatorDeclaredOriginality ? (
            <div className="space-y-2 text-sm">
              {creatorDuplicateExplanation ? (
                <div>
                  <div className="text-muted-foreground">Overlap details</div>
                  <div className="text-foreground whitespace-pre-wrap">{creatorDuplicateExplanation}</div>
                </div>
              ) : null}
              <div>
                <div className="text-muted-foreground">Uniqueness rationale</div>
                <div className="text-foreground whitespace-pre-wrap">
                  {creatorOriginalityRationale || "No rationale was saved."}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="platform-surface-card p-6 space-y-4">
        <div className="text-foreground font-semibold text-lg">Reviewer comments</div>
        {reviews.length === 0 ? (
          <div className="text-muted-foreground">No comments yet.</div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-4">
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
                {r.reviewJustification ? (
                  <ReviewJustificationSummary justification={r.reviewJustification} />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="platform-surface-card p-6 space-y-5">
        <div className="text-foreground font-semibold text-lg">Project details</div>

        <fieldset disabled={saving || isGranted} className={isGranted ? "opacity-60" : ""}>
        <label className="block">
          <div className="text-sm text-muted-foreground font-medium mb-2">Editor / app</div>
          <Select value={editor} onValueChange={(v) => { if (v) setEditor(v as ProjectEditor); }}>
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
              value={editorOther}
              onChange={(e) => setEditorOther(e.target.value)}
              required
              className="w-full bg-background border border-border rounded-[var(--radius-2xl)] px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
              placeholder="e.g. JetBrains, Sublime, ..."
            />
          </label>
        ) : null}

        <label className="block">
          <div className="text-sm text-muted-foreground font-medium mb-2">Project name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-background border border-border rounded-[var(--radius-2xl)] px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
            placeholder="My awesome game"
          />
        </label>

        <label className="block">
          <div className="text-sm text-muted-foreground font-medium mb-2">Hackatime project name</div>
          <div className="space-y-2">
            <Select
              value={hackatimeProjectName || "__none__"}
              onValueChange={(v) => {
                const next = !v || v === "__none__" ? "" : v;
                setHackatimeProjectName(next);
                const selected = (hackatimeProjects ?? []).find((p) => p.name === next) ?? null;
                setHackatimeStartedAt(selected?.startedAt ?? null);
                setHackatimeStoppedAt(selected?.stoppedAt ?? null);
                setHackatimeTotalSeconds(selected?.totalSeconds ?? null);
                setSubmitRangeStartDate(toDateInputValue(selected?.startedAt ?? null));
                setSubmitRangeEndDate(toDateInputValue(selected?.stoppedAt ?? null));
              }}
              disabled={hackatimeLoading || (hackatimeProjects?.length ?? 0) === 0}
            >
              <SelectTrigger className="w-full h-11 rounded-[var(--radius-2xl)] border-border bg-background px-4 text-foreground">
                <SelectValue placeholder="Select a Hackatime project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select a Hackatime project</SelectItem>
                {hackatimeProjects?.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <div>Fetched from your Hackatime account.</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setHackatimeProjectName("");
                    setHackatimeStartedAt(null);
                    setHackatimeStoppedAt(null);
                    setHackatimeTotalSeconds(null);
                    setSubmitRangeStartDate("");
                    setSubmitRangeEndDate("");
                  }}
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
            {hackatimeProjectName ? (
              <div className="rounded-[var(--radius-xl)]  border border-border bg-muted px-3 py-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <div className="text-xs text-muted-foreground mb-1">Considered start date</div>
                    <DatePicker value={submitRangeStartDate} onChange={(v) => setSubmitRangeStartDate(v)} disabled={saving || isGranted} />
                  </label>
                  <label className="block">
                    <div className="text-xs text-muted-foreground mb-1">Considered end date</div>
                    <DatePicker value={submitRangeEndDate} onChange={(v) => setSubmitRangeEndDate(v)} disabled={saving || isGranted} />
                  </label>
                </div>
                {!submitConsideredRange.ok ? (
                  <div className="text-xs text-red-200">{submitConsideredRange.error}</div>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    Considered Hackatime range:{" "}
                    <span className="text-foreground font-semibold">{currentConsideredRangeLabel}</span>
                  </span>
                  <span>
                    Considered Hackatime hours:{" "}
                    <span className="text-foreground font-semibold">{currentHackatimeHoursLabel}</span>
                  </span>
                </div>
                {hackatimePreviewLoading ? (
                  <div className="text-xs text-muted-foreground">Refreshing Hackatime hours…</div>
                ) : null}
                {hackatimePreviewError ? (
                  <div className="text-xs text-red-200">{hackatimePreviewError}</div>
                ) : null}
              </div>
            ) : null}
            {hackatimeConnectUrl ? (
              <a
                href={hackatimeConnectUrl}
                className="inline-flex items-center justify-center bg-carnival-blue hover:bg-carnival-blue/80 text-white px-4 py-2 rounded-[var(--radius-xl)] font-semibold transition-colors"
              >
                Connect Hackatime
              </a>
            ) : null}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-sm text-muted-foreground font-medium mb-2">Category</div>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              list="manage-project-category-suggestions"
              className="w-full bg-background border border-border rounded-[var(--radius-2xl)] px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
              placeholder="e.g. Productivity, Game Dev"
            />
            <datalist id="manage-project-category-suggestions">
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
                    className="rounded-[var(--carnival-squircle-radius)] border border-border bg-muted px-2.5 py-1 text-xs text-foreground hover:bg-muted/70 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            ) : null}
          </label>
        </div>

        <label className="block">
          <div className="text-sm text-muted-foreground font-medium mb-2">Description</div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="w-full bg-background border border-border rounded-[var(--radius-2xl)] px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
            placeholder="What are you building?"
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-sm text-muted-foreground font-medium mb-2">Video link</div>
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              required
              className="w-full bg-background border border-border rounded-[var(--radius-2xl)] px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
              placeholder="https://youtu.be/... or https://..."
            />
          </label>

          <label className="block">
            <div className="text-sm text-muted-foreground font-medium mb-2">Playable demo link</div>
            <input
              value={playableDemoUrl}
              onChange={(e) => setPlayableDemoUrl(e.target.value)}
              required
              className="w-full bg-background border border-border rounded-[var(--radius-2xl)] px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
              placeholder="https://mygame.example.com or https://itch.io/..."
            />
          </label>

          <label className="block">
            <div className="text-sm text-muted-foreground font-medium mb-2">Code URL</div>
            <input
              value={codeUrl}
              onChange={(e) => setCodeUrl(e.target.value)}
              className="w-full bg-background border border-border rounded-[var(--radius-2xl)] px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
              placeholder="https://github.com/me/mygame"
            />
          </label>
        </div>

        {availableBounties.length > 0 ? (
          <div className="block">
            <div className="text-sm text-muted-foreground font-medium mb-2">
              Linked bounty <span className="font-normal">(optional)</span>
            </div>
            <Select
              value={bountyProjectId || "__none__"}
              onValueChange={(v) => setBountyProjectId(v === "__none__" ? null : v)}
              disabled={saving || isGranted}
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

        <div>
          <div className="text-sm text-muted-foreground font-medium mb-2">
            Screenshots
          </div>
          <ScreenshotGrid
            urls={screenshotUrls}
            onChange={setScreenshotUrls}
            projectId={initial.id}
            disabled={saving || isGranted}
          />
          <div className="mt-2 text-xs text-muted-foreground">
            Include screenshots of your project working (not your code). Required before submission.
          </div>
        </div>
        </fieldset>

        {error ? (
          <div className="rounded-[var(--radius-2xl)] border border-carnival-red/40 bg-carnival-red/10 px-4 py-3 text-sm text-red-200">
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
            className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-[var(--radius-xl)] font-bold transition-colors"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="platform-surface-card p-6 space-y-3">
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
            className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-[var(--radius-xl)] font-bold transition-colors"
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
              : "Only required checklist items block submission; optional answers are still shared with reviewers."
        }
        maxWidth="lg"
      >
        {submitStep === 0 ? (
          <div className="space-y-4">
            <div className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-4 text-sm text-muted-foreground">
              Complete all requirements before submitting: GitHub URL, video link, playable demo link, Hackatime project, considered range, at least 3 screenshots, and originality declaration.
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between  border border-border bg-background rounded-[var(--radius-xl)] px-3 py-2">
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
              <div className="flex items-center justify-between  border border-border bg-background rounded-[var(--radius-xl)] px-3 py-2">
              <div className="text-foreground">Video link</div>
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
            <div className="flex items-center justify-between  border border-border bg-background rounded-[var(--radius-xl)] px-3 py-2">
                <div className="text-foreground">Playable demo link</div>
                <div
                  className={[
                    "px-2 py-0.5 rounded-md font-bold",
                    submitRequirements.playableOk
                      ? "text-emerald-300 bg-emerald-500/15"
                      : "text-rose-300 bg-rose-500/15",
                  ].join(" ")}
                >
                  {submitRequirements.playableOk ? "Set" : "Missing/invalid"}
                </div>
              </div>
              <div className="flex items-center justify-between  border border-border bg-background rounded-[var(--radius-xl)] px-3 py-2">
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
              <div className="flex items-center justify-between  border border-border bg-background rounded-[var(--radius-xl)] px-3 py-2">
                <div className="text-foreground">Considered Hackatime range</div>
                <div
                  className={[
                    "px-2 py-0.5 rounded-md font-bold",
                    submitConsideredRange.ok
                      ? "text-emerald-300 bg-emerald-500/15"
                      : "text-rose-300 bg-rose-500/15",
                  ].join(" ")}
                >
                  {submitConsideredRange.ok ? "Set" : "Missing/invalid"}
                </div>
              </div>
              <div className="flex items-center justify-between  border border-border bg-background rounded-[var(--radius-xl)] px-3 py-2">
                <div className="text-foreground">Screenshots (min 3)</div>
                <div
                  className={[
                    "px-2 py-0.5 rounded-md font-bold",
                    submitRequirements.screenshotsOk
                      ? "text-emerald-300 bg-emerald-500/15"
                      : "text-rose-300 bg-rose-500/15",
                  ].join(" ")}
                >
                  {submitRequirements.screenshotsOk ? `${screenshots.length} uploaded` : `${screenshots.length}/3 needed`}
                </div>
              </div>
              <div className="flex items-center justify-between  border border-border bg-background rounded-[var(--radius-xl)] px-3 py-2">
                <div className="text-foreground">Originality declaration</div>
                <div
                  className={[
                    "px-2 py-0.5 rounded-md font-bold",
                    submitRequirements.declarationOk
                      ? "text-emerald-300 bg-emerald-500/15"
                      : "text-rose-300 bg-rose-500/15",
                  ].join(" ")}
                >
                  {submitRequirements.declarationOk ? "Set" : "Missing"}
                </div>
              </div>
              {editor === "other" ? (
                <div className="flex items-center justify-between  border border-border bg-background rounded-[var(--radius-xl)] px-3 py-2">
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

            <div className="rounded-[var(--radius-2xl)]  border border-border bg-background px-4 py-4 space-y-3">
              <div>
                <div className="text-foreground font-semibold">Considered Hackatime range</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Reviewers will use this window when checking the project’s tracked time.
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-xs text-muted-foreground mb-1">Start date</div>
                  <DatePicker value={submitRangeStartDate} onChange={(v) => setSubmitRangeStartDate(v)} />
                </label>
                <label className="block">
                  <div className="text-xs text-muted-foreground mb-1">End date</div>
                  <DatePicker value={submitRangeEndDate} onChange={(v) => setSubmitRangeEndDate(v)} />
                </label>
              </div>
              {!submitConsideredRange.ok ? (
                <div className="text-xs text-red-200">{submitConsideredRange.error}</div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeSubmit}
                className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 text-foreground px-5 py-2.5 rounded-[var(--radius-xl)] font-semibold transition-colors border border-border"
                disabled={submitting}
              >
                Not yet
              </button>
              <button
                type="button"
                onClick={() => setSubmitStep(1)}
                className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-[var(--radius-xl)] font-bold transition-colors"
                disabled={!submitRequirements.allOk || !submitConsideredRange.ok || submitting}
              >
                Continue
              </button>
            </div>
          </div>
        ) : (
          isReReview ? (
            <div className="space-y-4">
              <div className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-4">
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
                  className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 text-foreground px-5 py-2.5 rounded-[var(--radius-xl)] font-semibold transition-colors border border-border"
                  disabled={submitting}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={onSubmitForReview}
                  className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-[var(--radius-xl)] font-bold transition-colors"
                  disabled={!submitRequirements.allOk || !checkAddressedRejection || submitting}
                >
                  {submitting ? "Submitting…" : "Submit for re-review"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-[var(--radius-2xl)] border border-border bg-muted px-4 py-3 text-xs text-muted-foreground">
                Required items must be checked. Optional items are recorded for reviewer context.
              </div>
              <div className="space-y-3">
                {PROJECT_SUBMISSION_CHECKLIST_ITEMS.map((item) => (
                  <label key={item.key} className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={submissionChecklist[item.key]}
                      onChange={(e) => setChecklistValue(item.key, e.target.checked)}
                      className="mt-1"
                    />
                    <div>
                      <div className="text-foreground font-semibold">
                        {item.label}
                        <span
                          className={[
                            "ml-2 inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide",
                            item.required
                              ? "bg-rose-500/15 text-rose-200"
                              : "bg-emerald-500/15 text-emerald-200",
                          ].join(" ")}
                        >
                          {item.required ? "Required" : "Optional"}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">{item.helper}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSubmitStep(0)}
                  className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 text-foreground px-5 py-2.5 rounded-[var(--radius-xl)] font-semibold transition-colors border border-border"
                  disabled={submitting}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={onSubmitForReview}
                  className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-[var(--radius-xl)] font-bold transition-colors"
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
          <div className="rounded-[var(--radius-2xl)] border border-carnival-red/40 bg-carnival-red/10 px-4 py-3 text-sm text-red-200">
            Deleting will permanently remove this project and any review comments. You can only delete while work-in-progress.
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeDeleteConfirm}
              disabled={deleting}
              className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 text-foreground px-5 py-2.5 rounded-[var(--radius-xl)] font-semibold transition-colors border border-border"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onDeleteProject}
              disabled={deleting}
              className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-[var(--radius-xl)] font-bold transition-colors"
            >
              {deleting ? "Deleting…" : "Delete project"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

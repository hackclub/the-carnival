"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import type {
  ProjectEditor,
  ProjectStatus,
  ProjectSubmissionChecklist,
  ReviewDecision,
} from "@/db/schema";
import { buildBillyUrl } from "@/lib/constants";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import ProjectEditorBadge from "@/components/ProjectEditorBadge";
import ReviewJustificationSummary from "@/components/ReviewJustificationSummary";
import DevlogAssessmentPanel, {
  type ReviewDevlogFull,
} from "@/components/DevlogAssessmentPanel";
import {
  assessmentSecondsToApprovedHours,
  effectiveSecondsForAssessment,
  type DevlogAssessmentDraft,
} from "@/lib/devlog-assessments";
import { Modal } from "@/components/ui";
import { PROJECT_SUBMISSION_CHECKLIST_ITEMS } from "@/lib/project-submission-checklist";
import {
  buildReviewJustificationRequest,
  buildDefaultReviewJustificationDraft,
  calculateHoursReduction,
  normalizeApprovedHours,
  requiresDeflationReason,
  REVIEW_DEFLATION_REASON_OPTIONS,
  REVIEW_EVIDENCE_ITEMS,
  validateRequiredReviewJustification,
  type ReviewDeflationReason,
  type ReviewJustificationDraft,
  type ReviewJustificationPayload,
} from "@/lib/review-rules";
import {
  formatConsideredHackatimeRangeLabel,
  getProjectConsideredHackatimeRange,
  parseConsideredHackatimeRange,
  type ConsideredHackatimeRange,
} from "@/lib/hackatime-range";
import toast from "react-hot-toast";

type ReviewItem = {
  id: string;
  decision: ReviewDecision;
  reviewComment: string;
  approvedHours: number | null;
  hackatimeSnapshotSeconds: number;
  reviewJustification: ReviewJustificationPayload | null;
  createdAt: string; // ISO
  reviewerName: string;
  reviewerEmail: string;
};

type AssignmentItem = {
  reviewerId: string;
  reviewerName: string;
  reviewerEmail: string;
  createdAt: string; // ISO
};

type ReviewableProject = {
  id: string;
  name: string;
  description: string;
  editor: ProjectEditor;
  editorOther: string;
  hackatimeProjectName: string;
  videoUrl: string;
  playableDemoUrl: string;
  codeUrl: string;
  screenshots: string[];
  submissionChecklist: ProjectSubmissionChecklist | null;
  creatorDeclaredOriginality: boolean;
  creatorDuplicateExplanation: string | null;
  creatorOriginalityRationale: string | null;
  status: ProjectStatus;
  approvedHours: number | null;
  creatorName: string;
  creatorEmail: string;
  hackatimeUserId: string | null;
  hackatimeHours: { hours: number; minutes: number } | null;
  hackatimeStartedAt: string | null;
  hackatimeStoppedAt: string | null;
  createdAt: string; // ISO
  submittedAt: string | null; // ISO
};

function toHackatimeHours(totalSeconds: number | null | undefined) {
  const safeTotalSeconds =
    typeof totalSeconds === "number" && Number.isFinite(totalSeconds)
      ? Math.max(0, Math.floor(totalSeconds))
      : 0;
  return {
    hours: Math.floor(safeTotalSeconds / 3600),
    minutes: Math.floor(safeTotalSeconds / 60) % 60,
  };
}

function formatHoursMinutes(hours: number, minutes: number) {
  const safeHours = Number.isFinite(hours) ? Math.max(0, Math.floor(hours)) : 0;
  const safeMinutes = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;
  return `${safeHours}h${String(safeMinutes).padStart(2, "0")}m`;
}

export default function ReviewProjectClient({
  initial,
}: {
  initial: {
    isAdmin: boolean;
    viewerUserId: string;
    project: ReviewableProject;
    reviews: ReviewItem[];
    assignments: AssignmentItem[];
    devlogs: ReviewDevlogFull[];
  };
}) {
  const isAdmin = initial.isAdmin;
  const [project, setProject] = useState(initial.project);
  const [reviews, setReviews] = useState<ReviewItem[]>(initial.reviews);
  const [assignments, setAssignments] = useState<AssignmentItem[]>(initial.assignments);
  const [decision, setDecision] = useState<ReviewDecision>("comment");
  const [comment, setComment] = useState("");
  const [devlogAssessments, setDevlogAssessments] = useState<Record<string, DevlogAssessmentDraft>>({});
  const [submitting, setSubmitting] = useState(false);
  const [assignmentBusy, setAssignmentBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successAt, setSuccessAt] = useState<number | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showDismissConfirmationModal, setShowDismissConfirmationModal] = useState(false);
  const [dismissReason, setDismissReason] = useState("");
  const canonicalProjectRange = useMemo(
    () =>
      getProjectConsideredHackatimeRange({
        hackatimeStartedAt: project.hackatimeStartedAt,
        hackatimeStoppedAt: project.hackatimeStoppedAt,
        submittedAt: project.submittedAt,
        createdAt: project.createdAt,
      }),
    [project.createdAt, project.hackatimeStartedAt, project.hackatimeStoppedAt, project.submittedAt],
  );
  const canonicalProjectRangeLabel = useMemo(
    () => formatConsideredHackatimeRangeLabel(canonicalProjectRange),
    [canonicalProjectRange],
  );
  const defaultReviewStartDate = canonicalProjectRange?.startDate ?? "";
  const defaultReviewEndDate = canonicalProjectRange?.endDate ?? "";
  const [reviewJustificationDraft, setReviewJustificationDraftState] = useState<ReviewJustificationDraft>(() =>
    buildDefaultReviewJustificationDraft({
      hackatimeProjectName: initial.project.hackatimeProjectName,
      startDate:
        getProjectConsideredHackatimeRange({
          hackatimeStartedAt: initial.project.hackatimeStartedAt,
          hackatimeStoppedAt: initial.project.hackatimeStoppedAt,
          submittedAt: initial.project.submittedAt,
          createdAt: initial.project.createdAt,
        })?.startDate ?? "",
      endDate:
        getProjectConsideredHackatimeRange({
          hackatimeStartedAt: initial.project.hackatimeStartedAt,
          hackatimeStoppedAt: initial.project.hackatimeStoppedAt,
          submittedAt: initial.project.submittedAt,
          createdAt: initial.project.createdAt,
        })?.endDate ?? "",
    }),
  );
  const [approvalProjectRange, setApprovalProjectRange] = useState<ConsideredHackatimeRange>({
    startDate:
      getProjectConsideredHackatimeRange({
        hackatimeStartedAt: initial.project.hackatimeStartedAt,
        hackatimeStoppedAt: initial.project.hackatimeStoppedAt,
        submittedAt: initial.project.submittedAt,
        createdAt: initial.project.createdAt,
      })?.startDate ?? "",
    endDate:
      getProjectConsideredHackatimeRange({
        hackatimeStartedAt: initial.project.hackatimeStartedAt,
        hackatimeStoppedAt: initial.project.hackatimeStoppedAt,
        submittedAt: initial.project.submittedAt,
        createdAt: initial.project.createdAt,
      })?.endDate ?? "",
  });
  const reviewJustificationDraftRef = useRef(reviewJustificationDraft);
  const [modalError, setModalError] = useState<string | null>(null);
  const [adminHackatimePreview, setAdminHackatimePreview] = useState<{
    hackatimeTotalSeconds: number | null;
    hackatimeHours: { hours: number; minutes: number } | null;
  } | null>(null);
  const [adminHackatimePreviewLoading, setAdminHackatimePreviewLoading] = useState(false);
  const [adminHackatimePreviewError, setAdminHackatimePreviewError] = useState<string | null>(null);
  const adminApprovalRange = useMemo(
    () => parseConsideredHackatimeRange(approvalProjectRange),
    [approvalProjectRange],
  );

  const setReviewJustificationDraft = useCallback(
    (next: SetStateAction<ReviewJustificationDraft>) => {
      const resolved =
        typeof next === "function"
          ? (next as (value: ReviewJustificationDraft) => ReviewJustificationDraft)(
              reviewJustificationDraftRef.current,
            )
          : next;
      reviewJustificationDraftRef.current = resolved;
      setReviewJustificationDraftState(resolved);
    },
    [],
  );

  const assessmentsMap = useMemo(() => {
    return new Map<string, DevlogAssessmentDraft>(Object.entries(devlogAssessments));
  }, [devlogAssessments]);

  const allDevlogsAssessed = useMemo(() => {
    if (initial.devlogs.length === 0) return false;
    return initial.devlogs.every((d) => assessmentsMap.has(d.id));
  }, [assessmentsMap, initial.devlogs]);

  const assessedTotalSeconds = useMemo(() => {
    let total = 0;
    for (const d of initial.devlogs) {
      const a = assessmentsMap.get(d.id);
      if (!a) continue;
      total += effectiveSecondsForAssessment(
        { devlogId: d.id, durationSeconds: d.durationSeconds },
        { decision: a.decision, adjustedSeconds: a.adjustedSeconds ?? null },
      );
    }
    return total;
  }, [assessmentsMap, initial.devlogs]);

  const approvedHoursValue = useMemo(() => {
    if (assessedTotalSeconds <= 0) return null;
    const h = assessmentSecondsToApprovedHours(assessedTotalSeconds);
    return normalizeApprovedHours(h);
  }, [assessedTotalSeconds]);

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (comment.trim().length === 0) return false;
    if (decision === "approved") {
      if (!allDevlogsAssessed) return false;
      return approvedHoursValue !== null && approvedHoursValue > 0;
    }
    return true;
  }, [allDevlogsAssessed, approvedHoursValue, comment, decision, submitting]);

  const hackatimeLoggedHoursValue = useMemo(() => {
    if (!project.hackatimeHours) return null;
    return project.hackatimeHours.hours + project.hackatimeHours.minutes / 60;
  }, [project.hackatimeHours]);

  const hackatimeLoggedLabel = useMemo(() => {
    if (!project.hackatimeHours) return "Unavailable";
    return formatHoursMinutes(project.hackatimeHours.hours, project.hackatimeHours.minutes);
  }, [project.hackatimeHours]);

  useEffect(() => {
    if (!isAdmin || decision !== "approved") {
      setAdminHackatimePreview(null);
      setAdminHackatimePreviewLoading(false);
      setAdminHackatimePreviewError(null);
      return;
    }

    if (!adminApprovalRange.ok) {
      setAdminHackatimePreviewLoading(false);
      setAdminHackatimePreviewError(
        approvalProjectRange.startDate || approvalProjectRange.endDate ? adminApprovalRange.error : null,
      );
      return;
    }

    if (
      canonicalProjectRange &&
      canonicalProjectRange.startDate === adminApprovalRange.value.startDate &&
      canonicalProjectRange.endDate === adminApprovalRange.value.endDate
    ) {
      setAdminHackatimePreview({
        hackatimeTotalSeconds: project.hackatimeHours
          ? project.hackatimeHours.hours * 3600 + project.hackatimeHours.minutes * 60
          : null,
        hackatimeHours: project.hackatimeHours,
      });
      setAdminHackatimePreviewLoading(false);
      setAdminHackatimePreviewError(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setAdminHackatimePreviewLoading(true);
      setAdminHackatimePreviewError(null);
      try {
        const res = await fetch(`/api/admin/projects/${encodeURIComponent(project.id)}/hackatime-preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consideredHackatimeRange: adminApprovalRange.value,
          }),
        });
        const data = (await res.json().catch(() => null)) as
          | {
              project?: {
                hackatimeTotalSeconds?: number | null;
                hackatimeHours?: { hours?: number; minutes?: number } | null;
              };
              error?: unknown;
            }
          | null;
        if (cancelled) return;
        if (!res.ok) {
          const message =
            typeof data?.error === "string" ? data.error : "Failed to refresh Hackatime hours.";
          setAdminHackatimePreviewError(message);
          setAdminHackatimePreviewLoading(false);
          return;
        }
        const hours = data?.project?.hackatimeHours;
        setAdminHackatimePreview({
          hackatimeTotalSeconds:
            typeof data?.project?.hackatimeTotalSeconds === "number"
              ? data.project.hackatimeTotalSeconds
              : null,
          hackatimeHours:
            hours && typeof hours.hours === "number" && typeof hours.minutes === "number"
              ? { hours: hours.hours, minutes: hours.minutes }
              : null,
        });
        setAdminHackatimePreviewLoading(false);
      } catch {
        if (cancelled) return;
        setAdminHackatimePreviewError("Failed to refresh Hackatime hours.");
        setAdminHackatimePreviewLoading(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    adminApprovalRange,
    approvalProjectRange.endDate,
    approvalProjectRange.startDate,
    canonicalProjectRange,
    decision,
    isAdmin,
    project.hackatimeHours,
    project.id,
  ]);

  const approvalHackatimeHoursValue = useMemo(() => {
    if (
      isAdmin &&
      decision === "approved" &&
      adminHackatimePreview?.hackatimeHours
    ) {
      return (
        adminHackatimePreview.hackatimeHours.hours +
        adminHackatimePreview.hackatimeHours.minutes / 60
      );
    }
    return hackatimeLoggedHoursValue;
  }, [adminHackatimePreview, decision, hackatimeLoggedHoursValue, isAdmin]);

  const approvalHackatimeLabel = useMemo(() => {
    if (
      isAdmin &&
      decision === "approved" &&
      adminHackatimePreview?.hackatimeHours
    ) {
      return formatHoursMinutes(
        adminHackatimePreview.hackatimeHours.hours,
        adminHackatimePreview.hackatimeHours.minutes,
      );
    }
    return hackatimeLoggedLabel;
  }, [adminHackatimePreview, decision, hackatimeLoggedLabel, isAdmin]);

  const approvedHoursReduction = useMemo(() => {
    if (decision !== "approved") return 0;
    return calculateHoursReduction(approvalHackatimeHoursValue, approvedHoursValue);
  }, [approvalHackatimeHoursValue, approvedHoursValue, decision]);

  const deflationReasonRequired = useMemo(() => {
    if (decision !== "approved") return false;
    return requiresDeflationReason(approvalHackatimeHoursValue, approvedHoursValue);
  }, [approvalHackatimeHoursValue, approvedHoursValue, decision]);

  const isApprovedHoursReduced = approvedHoursReduction > 0;
  const otherDeflationReasonSelected = reviewJustificationDraft.deflationReasons.includes("other");

  const isAssignedToMe = useMemo(
    () => assignments.some((a) => a.reviewerId === initial.viewerUserId),
    [assignments, initial.viewerUserId],
  );

  const billyLink = useMemo(() => {
    const hackatimeId = project.hackatimeUserId?.trim();
    if (!hackatimeId || !canonicalProjectRange) return null;
    return buildBillyUrl(hackatimeId, canonicalProjectRange.startDate, canonicalProjectRange.endDate);
  }, [canonicalProjectRange, project.hackatimeUserId]);

  const resetReviewJustificationDraft = useCallback(() => {
    setReviewJustificationDraft(
      buildDefaultReviewJustificationDraft({
        hackatimeProjectName: project.hackatimeProjectName,
        startDate: defaultReviewStartDate,
        endDate: defaultReviewEndDate,
      }),
    );
    setApprovalProjectRange({
      startDate: defaultReviewStartDate,
      endDate: defaultReviewEndDate,
    });
    setModalError(null);
  }, [defaultReviewEndDate, defaultReviewStartDate, project.hackatimeProjectName]);

  const submitReview = useCallback(async (input: {
    requestReviewJustification: ReviewJustificationDraft | null;
    optimisticReviewJustification: ReviewJustificationPayload | null;
    consideredHackatimeRange: ConsideredHackatimeRange | null;
    dismiss?: boolean;
    dismissReason?: string;
  }) => {
    setSubmitting(true);
    setError(null);
    setSuccessAt(null);

    const dismiss = input.dismiss === true;
    const trimmedDismissReason = dismiss ? (input.dismissReason ?? "").trim() : "";
    const toastId = toast.loading(dismiss ? "Rejecting and dismissing…" : "Submitting review…");
    try {
      const assessmentsPayload = Object.values(devlogAssessments).map((a) => ({
        devlogId: a.devlogId,
        decision: a.decision,
        ...(a.decision === "adjusted"
          ? { adjustedSeconds: Math.max(0, Math.floor(a.adjustedSeconds ?? 0)) }
          : {}),
        ...(a.comment ? { comment: a.comment } : {}),
      }));

      const res = await fetch(`/api/review/${encodeURIComponent(project.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          comment: comment.trim(),
          approvedHours: decision === "approved" ? approvedHoursValue : null,
          reviewJustification: input.requestReviewJustification,
          consideredHackatimeRange: input.consideredHackatimeRange,
          devlogAssessments: assessmentsPayload,
          ...(dismiss ? { dismiss: true, dismissReason: trimmedDismissReason } : {}),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            project?: {
              status?: ProjectStatus;
              approvedHours?: number | null;
              hackatimeStartedAt?: string | null;
              hackatimeStoppedAt?: string | null;
              hackatimeTotalSeconds?: number | null;
            };
            review?: Omit<ReviewItem, "reviewJustification"> & {
              reviewJustification?: ReviewJustificationPayload | null;
            };
            error?: unknown;
          }
        | null;

      if (!res.ok) {
        const message =
          typeof data?.error === "string" ? data.error : "Failed to submit review.";
        setError(message);
        toast.error(message, { id: toastId });
        setSubmitting(false);
        return;
      }

      if (data?.project?.status) {
        setProject((p) => ({
          ...p,
          status: data.project!.status!,
          approvedHours:
            data.project?.approvedHours !== undefined ? data.project.approvedHours : p.approvedHours,
          hackatimeStartedAt:
            data.project?.hackatimeStartedAt !== undefined
              ? data.project.hackatimeStartedAt
              : p.hackatimeStartedAt,
          hackatimeStoppedAt:
            data.project?.hackatimeStoppedAt !== undefined
              ? data.project.hackatimeStoppedAt
              : p.hackatimeStoppedAt,
          hackatimeHours:
            typeof data.project?.hackatimeTotalSeconds === "number"
              ? toHackatimeHours(data.project.hackatimeTotalSeconds)
              : p.hackatimeHours,
        }));
      }

      if (data?.review) {
        const nextReview: ReviewItem = {
          ...data.review,
          reviewJustification:
            data.review.reviewJustification ?? input.optimisticReviewJustification ?? null,
        };
        setReviews((prev) => [...prev, nextReview]);
      }

      setComment("");
      setDecision("comment");
      setDevlogAssessments({});
      setShowConfirmationModal(false);
      setShowDismissConfirmationModal(false);
      setDismissReason("");
      resetReviewJustificationDraft();
      setSuccessAt(Date.now());
      toast.success(dismiss ? "Project rejected and dismissed." : "Review submitted.", {
        id: toastId,
      });
      setSubmitting(false);
    } catch {
      const failureMessage = dismiss ? "Failed to dismiss project." : "Failed to submit review.";
      setError(failureMessage);
      toast.error(failureMessage, { id: toastId });
      setSubmitting(false);
    }
  }, [
    approvedHoursValue,
    comment,
    decision,
    devlogAssessments,
    project.id,
    resetReviewJustificationDraft,
  ]);

  const onSubmit = useCallback(() => {
    if (!canSubmit) return;
    if (decision !== "approved") {
      void submitReview({
        requestReviewJustification: null,
        optimisticReviewJustification: null,
        consideredHackatimeRange: null,
      });
      return;
    }
    setModalError(null);
    setShowConfirmationModal(true);
  }, [canSubmit, decision, submitReview]);

  const onConfirmSubmission = useCallback(() => {
    if (decision !== "approved") return;

    let consideredHackatimeRange: ConsideredHackatimeRange | null = null;
    if (isAdmin) {
      if (!adminApprovalRange.ok) {
        setModalError(adminApprovalRange.error);
        return;
      }
      consideredHackatimeRange = adminApprovalRange.value;
    }

    const draft = {
      ...reviewJustificationDraftRef.current,
      hackatimeProjectName: project.hackatimeProjectName,
      reviewDateRange: isAdmin
        ? (consideredHackatimeRange ?? reviewJustificationDraftRef.current.reviewDateRange)
        : reviewJustificationDraftRef.current.reviewDateRange,
    };

    const validated = validateRequiredReviewJustification({
      value: draft,
      decision,
      expectedHackatimeProjectName: project.hackatimeProjectName,
      approvedHours: approvedHoursValue,
      loggedHackatimeHours: approvalHackatimeHoursValue,
    });

    if (!validated.ok) {
      setModalError(validated.error);
      return;
    }

    setModalError(null);
    setShowConfirmationModal(false);
    void submitReview({
      requestReviewJustification: buildReviewJustificationRequest(draft, {
        hackatimeProjectName: project.hackatimeProjectName,
      }),
      optimisticReviewJustification: validated.value,
      consideredHackatimeRange,
    });
  }, [
    adminApprovalRange,
    approvalHackatimeHoursValue,
    approvedHoursValue,
    decision,
    isAdmin,
    project.hackatimeProjectName,
    submitReview,
  ]);

  const onCloseConfirmationModal = useCallback(() => {
    if (submitting) return;
    setShowConfirmationModal(false);
    setModalError(null);
  }, [submitting]);

  const onToggleEvidence = useCallback((key: keyof ReviewJustificationDraft["evidence"]) => {
    setReviewJustificationDraft((prev) => ({
      ...prev,
      evidence: {
        ...prev.evidence,
        [key]: !prev.evidence[key],
      },
    }));
    setModalError(null);
  }, []);

  const onToggleDeflationReason = useCallback((reason: ReviewDeflationReason) => {
    setReviewJustificationDraft((prev) => {
      const exists = prev.deflationReasons.includes(reason);
      const nextReasons = exists
        ? prev.deflationReasons.filter((item) => item !== reason)
        : [...prev.deflationReasons, reason];
      return { ...prev, deflationReasons: nextReasons };
    });
    setModalError(null);
  }, []);

  const onDecisionChange = useCallback((nextDecision: ReviewDecision) => {
    setDecision(nextDecision);
    setError(null);
    setModalError(null);
    if (nextDecision !== "approved") {
      setShowConfirmationModal(false);
      return;
    }
    setApprovalProjectRange({
      startDate: defaultReviewStartDate,
      endDate: defaultReviewEndDate,
    });
  }, [defaultReviewEndDate, defaultReviewStartDate]);

  const onDeleteReview = useCallback(
    async (reviewId: string) => {
      if (!isAdmin) return;
      const toastId = toast.loading("Deleting comment…");
      try {
        const res = await fetch(`/api/review/comments/${encodeURIComponent(reviewId)}`, {
          method: "DELETE",
        });
        const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
        if (!res.ok) {
          const message = typeof data?.error === "string" ? data.error : "Failed to delete comment.";
          toast.error(message, { id: toastId });
          return;
        }
        setReviews((prev) => prev.filter((r) => r.id !== reviewId));
        toast.success("Deleted.", { id: toastId });
      } catch {
        toast.error("Failed to delete comment.", { id: toastId });
      }
    },
    [isAdmin],
  );

  const onToggleAssignment = useCallback(async () => {
    if (assignmentBusy) return;
    setAssignmentBusy(true);
    const assigning = !isAssignedToMe;
    const toastId = toast.loading(assigning ? "Assigning to you…" : "Removing your assignment…");
    try {
      const res = await fetch(`/api/review/${encodeURIComponent(project.id)}/assignment`, {
        method: assigning ? "POST" : "DELETE",
      });
      const data = (await res.json().catch(() => null)) as
        | { assignments?: AssignmentItem[]; error?: unknown }
        | null;
      if (!res.ok) {
        const message = typeof data?.error === "string" ? data.error : "Failed to update assignment.";
        toast.error(message, { id: toastId });
        setAssignmentBusy(false);
        return;
      }

      setAssignments(data?.assignments ?? []);
      toast.success(assigning ? "Assigned to you." : "Unassigned.", { id: toastId });
      setAssignmentBusy(false);
    } catch {
      toast.error("Failed to update assignment.", { id: toastId });
      setAssignmentBusy(false);
    }
  }, [assignmentBusy, isAssignedToMe, project.id]);

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-foreground font-bold text-2xl truncate">{project.name}</div>
            <div className="text-muted-foreground mt-1 text-sm truncate">
              {project.creatorName}
              {project.creatorEmail ? ` • ${project.creatorEmail}` : ""}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <ProjectEditorBadge editor={project.editor} editorOther={project.editorOther} />
            <ProjectStatusBadge status={project.status} />
          </div>
        </div>
        <div className="text-muted-foreground mt-4">{project.description}</div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="text-foreground font-semibold text-lg">Review info</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-2xl border border-border bg-muted px-4 py-3">
            <div className="text-muted-foreground">Created</div>
            <div className="text-foreground font-semibold">
              {new Date(project.createdAt).toLocaleString()}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-muted px-4 py-3">
            <div className="text-muted-foreground">Submitted</div>
            <div className="text-foreground font-semibold">
              {project.submittedAt ? new Date(project.submittedAt).toLocaleString() : "—"}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-muted px-4 py-3 md:col-span-1">
            <div className="text-muted-foreground">Considered Hackatime range</div>
            <div className="text-foreground font-semibold">{canonicalProjectRangeLabel}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-muted px-4 py-4 space-y-3">
          <div className="text-foreground font-semibold">Submission checklist</div>
          {project.submissionChecklist ? (
            <div className="space-y-2">
              {PROJECT_SUBMISSION_CHECKLIST_ITEMS.map((item) => {
                const checked = project.submissionChecklist?.[item.key] ?? false;
                return (
                  <div key={item.key} className="flex items-start justify-between gap-3">
                    <div className="text-sm text-foreground">{item.label}</div>
                    <div className="shrink-0 flex items-center gap-2">
                      <span
                        className={[
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide",
                          item.required
                            ? "bg-rose-500/15 text-rose-200"
                            : "bg-emerald-500/15 text-emerald-200",
                        ].join(" ")}
                      >
                        {item.required ? "Required" : "Optional"}
                      </span>
                      <span
                        className={[
                          "text-xs font-semibold uppercase tracking-wide",
                          checked ? "text-emerald-300" : "text-muted-foreground",
                        ].join(" ")}
                      >
                        {checked ? "Checked" : "Unchecked"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No checklist state was saved for this submission.
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href={project.playableDemoUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-border bg-muted px-4 py-3 hover:bg-muted/70 transition-colors"
          >
            <div className="text-sm text-muted-foreground">Playable demo link</div>
            <div className="text-foreground font-semibold truncate">{project.playableDemoUrl}</div>
          </a>
          <a
            href={project.videoUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-border bg-muted px-4 py-3 hover:bg-muted/70 transition-colors"
          >
            <div className="text-sm text-muted-foreground">Video</div>
            <div className="text-foreground font-semibold truncate">{project.videoUrl}</div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border bg-muted px-4 py-3">
            <div className="text-sm text-muted-foreground">Hackatime project</div>
            <div className="text-foreground font-semibold truncate">
              <span className="font-mono">{project.hackatimeProjectName || "—"}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-muted px-4 py-3">
            <div className="text-sm text-muted-foreground">Hackatime hours (this project)</div>
            <div className="text-foreground font-semibold">{hackatimeLoggedLabel}</div>
          </div>
          {billyLink ? (
            <a
              href={billyLink}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-border bg-muted px-4 py-3 hover:bg-muted/70 transition-colors"
            >
              <div className="text-sm text-muted-foreground">Hackatime review link</div>
              <div className="text-foreground font-semibold truncate">{billyLink}</div>
            </a>
          ) : (
            <div className="rounded-2xl border border-border bg-muted px-4 py-3">
              <div className="text-sm text-muted-foreground">Hackatime review link</div>
              <div className="text-foreground font-semibold">—</div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-muted px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Reviewer assignments</div>
              <div className="text-foreground font-semibold">
                {assignments.length === 0
                  ? "No reviewers assigned"
                  : `${assignments.length} reviewer${assignments.length === 1 ? "" : "s"} assigned`}
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleAssignment}
              disabled={assignmentBusy}
              className="inline-flex items-center justify-center bg-background hover:bg-background/80 disabled:bg-background/50 disabled:cursor-not-allowed text-foreground px-4 py-2 rounded-full font-semibold transition-colors border border-border"
            >
              {assignmentBusy ? "Updating…" : isAssignedToMe ? "Unassign me" : "Assign to me"}
            </button>
          </div>
          {assignments.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {assignments.map((a) => (
                <div key={`${a.reviewerId}-${a.createdAt}`} className="rounded-full border border-border bg-card px-3 py-1">
                  <span className="text-xs text-foreground font-semibold">
                    {a.reviewerName}
                    {a.reviewerId === initial.viewerUserId ? " (You)" : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {project.screenshots?.length ? (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="text-foreground font-semibold text-lg">Screenshots</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {project.screenshots.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt=""
                className="w-full rounded-2xl border border-border object-cover bg-muted"
                referrerPolicy="no-referrer"
              />
            ))}
          </div>
        </div>
      ) : null}

      <DevlogAssessmentPanel
        projectId={project.id}
        devlogs={initial.devlogs}
        assessments={devlogAssessments}
        onChange={setDevlogAssessments}
      />

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="text-foreground font-semibold text-lg">Leave a review</div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => onDecisionChange("approved")}
            className={[
              "rounded-2xl border px-4 py-3 text-left transition-colors",
              decision === "approved"
                ? "border-carnival-blue/50 bg-carnival-blue/10"
                : "border-border bg-muted hover:bg-muted/70",
            ].join(" ")}
          >
            <div className="text-foreground font-semibold">Approve</div>
            <div className="text-sm text-muted-foreground">Mark as shipped.</div>
          </button>
          <button
            type="button"
            onClick={() => onDecisionChange("rejected")}
            className={[
              "rounded-2xl border px-4 py-3 text-left transition-colors",
              decision === "rejected"
                ? "border-carnival-blue/50 bg-carnival-blue/10"
                : "border-border bg-muted hover:bg-muted/70",
            ].join(" ")}
          >
            <div className="text-foreground font-semibold">Reject</div>
            <div className="text-sm text-muted-foreground">Send back to work in progress.</div>
          </button>
          <button
            type="button"
            onClick={() => onDecisionChange("comment")}
            className={[
              "rounded-2xl border px-4 py-3 text-left transition-colors",
              decision === "comment"
                ? "border-carnival-blue/50 bg-carnival-blue/10"
                : "border-border bg-muted hover:bg-muted/70",
            ].join(" ")}
          >
            <div className="text-foreground font-semibold">Comment</div>
            <div className="text-sm text-muted-foreground">Keep in review queue.</div>
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-muted px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">Approved hours</div>
            <div className="text-sm font-semibold text-foreground">
              {approvedHoursValue !== null
                ? `${approvedHoursValue}h`
                : initial.devlogs.length === 0
                  ? "No devlogs yet"
                  : allDevlogsAssessed
                    ? "0h"
                    : "Pending assessment"}
            </div>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Approved hours is the sum of accepted and adjusted devlog durations, snapped down to
            the nearest 0.1h. Assess each devlog below before approving.
          </div>
          {decision === "approved" && !allDevlogsAssessed ? (
            <div className="mt-2 text-xs text-red-200">
              {initial.devlogs.length === 0
                ? "There are no devlogs; the creator must post at least one before you can approve."
                : `Assess every devlog before approving (${Object.keys(devlogAssessments).length}/${initial.devlogs.length} done).`}
            </div>
          ) : null}
        </div>

        <label className="block">
          <div className="text-sm text-muted-foreground font-medium mb-2">Comment</div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={5}
            className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
            placeholder="Be specific and kind. What should they improve?"
          />
        </label>

        {error ? (
          <div className="rounded-2xl border border-carnival-red/40 bg-carnival-red/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {decision === "approved" ? (
          <div className="rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
            Approvals require confirmation with evidence checks and a review range.
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="text-sm text-muted-foreground">{successAt ? "Submitted." : null}</div>
          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && decision === "rejected" ? (
              <button
                type="button"
                onClick={() => {
                  if (!canSubmit) return;
                  setShowDismissConfirmationModal(true);
                }}
                disabled={!canSubmit}
                className="inline-flex items-center justify-center border border-carnival-red/60 bg-carnival-red/10 hover:bg-carnival-red/20 disabled:opacity-50 disabled:cursor-not-allowed text-carnival-red px-6 py-3 rounded-full font-bold transition-colors"
                title="Reject and prevent resubmission"
              >
                Reject and dismiss
              </button>
            ) : null}
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-full font-bold transition-colors"
            >
              {submitting ? "Submitting…" : "Submit review"}
            </button>
          </div>
        </div>
        {isAdmin && decision === "rejected" ? (
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Reject and dismiss</span> rejects the
            project and prevents the creator from resubmitting it. You can re-enable resubmission
            later from the <span className="font-semibold text-foreground">Dismissed projects</span>{" "}
            admin page.
          </div>
        ) : null}
      </div>

      <Modal
        open={showDismissConfirmationModal}
        onClose={() => {
          if (submitting) return;
          setShowDismissConfirmationModal(false);
          setDismissReason("");
        }}
        title="Reject and dismiss project?"
        description="The project will be moved to work-in-progress, and the creator will not be able to resubmit it for review."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-carnival-red/40 bg-carnival-red/10 px-4 py-3 text-sm text-foreground">
            <div className="font-semibold mb-1">Heads up</div>
            <div className="text-muted-foreground">
              The creator will receive a rejection notice noting that the project was dismissed. An
              admin can later re-enable resubmission from the{" "}
              <span className="font-semibold text-foreground">Dismissed projects</span> admin page.
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
            <div className="font-semibold text-foreground mb-1">Reviewer comment</div>
            <div className="whitespace-pre-wrap">{comment.trim() || "(empty — please add a comment before dismissing)"}</div>
          </div>
          <div className="space-y-2">
            <label htmlFor="dismiss-reason" className="block text-sm font-semibold text-foreground">
              Reason shown to the creator
            </label>
            <textarea
              id="dismiss-reason"
              value={dismissReason}
              onChange={(event) => setDismissReason(event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Explain why this project is being dismissed. The creator will see this in the banner on their project page."
              disabled={submitting}
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-carnival-red disabled:opacity-60"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>The creator will see this on their project page.</span>
              <span>{dismissReason.trim().length}/2000</span>
            </div>
          </div>
          {error ? (
            <div className="rounded-2xl border border-carnival-red/40 bg-carnival-red/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                if (submitting) return;
                setShowDismissConfirmationModal(false);
                setDismissReason("");
              }}
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-full border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canSubmit) return;
                if (!dismissReason.trim()) return;
                void submitReview({
                  requestReviewJustification: null,
                  optimisticReviewJustification: null,
                  consideredHackatimeRange: null,
                  dismiss: true,
                  dismissReason,
                });
              }}
              disabled={!canSubmit || !dismissReason.trim()}
              className="inline-flex items-center justify-center rounded-full bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-5 py-2.5 text-sm font-bold transition-colors"
            >
              {submitting ? "Dismissing…" : "Reject and dismiss"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={showConfirmationModal && decision === "approved"}
        onClose={onCloseConfirmationModal}
        title="Confirm approval"
        description="Before submitting, confirm review evidence and the approval review range."
        maxWidth="lg"
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
            <div>
              Logged Hackatime for this project:{" "}
              <span className="text-foreground font-semibold">{approvalHackatimeLabel}</span>
            </div>
            {decision === "approved" && approvedHoursValue !== null ? (
              <div className="mt-1">
                Approved hours: <span className="text-foreground font-semibold">{approvedHoursValue}h</span>
                {isApprovedHoursReduced ? (
                  <span className="text-foreground">
                    {" "}
                    ({approvedHoursReduction.toFixed(2)}h lower than logged)
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="text-sm font-semibold text-foreground">Evidence checklist</div>

            <div className="block">
              <div className="text-xs text-muted-foreground mb-2">Hackatime project name reviewed</div>
              <div className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground font-mono">
                {project.hackatimeProjectName || "—"}
              </div>
            </div>

            <div className="space-y-2">
              {REVIEW_EVIDENCE_ITEMS.map((item) => (
                <label
                  key={item.key}
                  className="flex items-start gap-3 rounded-xl border border-border bg-background px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={reviewJustificationDraft.evidence[item.key]}
                    onChange={() => onToggleEvidence(item.key)}
                    className="mt-0.5 h-4 w-4 rounded border-border accent-carnival-blue"
                  />
                  <span className="text-sm text-foreground">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {isAdmin ? (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-foreground">Project considered range</div>
              <div className="text-xs text-muted-foreground">
                This updates the project’s canonical Hackatime window before approval and is also used for this approval note.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-xs text-muted-foreground mb-1">Start date</div>
                  <input
                    type="date"
                    value={approvalProjectRange.startDate}
                    onChange={(e) => {
                      setApprovalProjectRange((prev) => ({ ...prev, startDate: e.target.value }));
                      setModalError(null);
                    }}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
                  />
                </label>
                <label className="block">
                  <div className="text-xs text-muted-foreground mb-1">End date</div>
                  <input
                    type="date"
                    value={approvalProjectRange.endDate}
                    onChange={(e) => {
                      setApprovalProjectRange((prev) => ({ ...prev, endDate: e.target.value }));
                      setModalError(null);
                    }}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
                  />
                </label>
              </div>
              {!adminApprovalRange.ok ? (
                <div className="text-xs text-red-200">{adminApprovalRange.error}</div>
              ) : null}
              {adminHackatimePreviewLoading ? (
                <div className="text-xs text-muted-foreground">Refreshing Hackatime hours…</div>
              ) : null}
              {adminHackatimePreviewError ? (
                <div className="text-xs text-red-200">{adminHackatimePreviewError}</div>
              ) : null}
              <div className="text-xs text-muted-foreground">
                Previewed Hackatime hours for this range:{" "}
                <span className="text-foreground font-semibold">{approvalHackatimeLabel}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-foreground">Review date range</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-xs text-muted-foreground mb-1">Start date</div>
                  <input
                    type="date"
                    value={reviewJustificationDraft.reviewDateRange.startDate}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setReviewJustificationDraft((prev) => ({
                        ...prev,
                        reviewDateRange: { ...prev.reviewDateRange, startDate: nextValue },
                      }));
                      setModalError(null);
                    }}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
                  />
                </label>
                <label className="block">
                  <div className="text-xs text-muted-foreground mb-1">End date</div>
                  <input
                    type="date"
                    value={reviewJustificationDraft.reviewDateRange.endDate}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setReviewJustificationDraft((prev) => ({
                        ...prev,
                        reviewDateRange: { ...prev.reviewDateRange, endDate: nextValue },
                      }));
                      setModalError(null);
                    }}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
                  />
                </label>
              </div>
            </div>
          )}

          {decision === "approved" && isApprovedHoursReduced ? (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-foreground">
                Hours deflation rationale
              </div>
              <div className="text-xs text-muted-foreground">
                {deflationReasonRequired
                  ? "At least one reason is required because approved hours are 0.5h or more below logged Hackatime."
                  : "Reason is optional for reductions under 0.5h, but still recommended."}{" "}
                The reduction itself can be any amount based on logged Hackatime.
              </div>
              <div className="space-y-2">
                {REVIEW_DEFLATION_REASON_OPTIONS.map((option) => (
                  <label
                    key={option.key}
                    className="flex items-start gap-3 rounded-xl border border-border bg-background px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={reviewJustificationDraft.deflationReasons.includes(option.key)}
                      onChange={() => onToggleDeflationReason(option.key)}
                      className="mt-0.5 h-4 w-4 rounded border-border accent-carnival-blue"
                    />
                    <span className="text-sm text-foreground">{option.label}</span>
                  </label>
                ))}
              </div>
              <label className="block">
                <div className="text-xs text-muted-foreground mb-1">
                  {otherDeflationReasonSelected ? "Note (required when selecting Other)" : "Optional note"}
                </div>
                <textarea
                  value={reviewJustificationDraft.deflationNote}
                  onChange={(e) => {
                    setReviewJustificationDraft((prev) => ({
                      ...prev,
                      deflationNote: e.target.value,
                    }));
                    setModalError(null);
                  }}
                  rows={3}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
                  placeholder="Explain context for the reduced approved hours."
                />
              </label>
            </div>
          ) : null}

          {modalError ? (
            <div className="rounded-2xl border border-carnival-red/40 bg-carnival-red/10 px-4 py-3 text-sm text-red-200">
              {modalError}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onCloseConfirmationModal}
              disabled={submitting}
              className="inline-flex items-center justify-center bg-muted hover:bg-muted/70 disabled:bg-muted/40 disabled:cursor-not-allowed text-foreground px-4 py-2 rounded-full font-semibold transition-colors border border-border"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirmSubmission}
              disabled={submitting}
              className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-full font-bold transition-colors"
            >
              {submitting ? "Submitting…" : "Confirm and submit"}
            </button>
          </div>
        </div>
      </Modal>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="text-foreground font-semibold text-lg">Review history</div>
        {reviews.length === 0 ? (
          <div className="text-muted-foreground">No reviews yet.</div>
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
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {r.decision}
                    </span>
                    {r.approvedHours !== null && r.approvedHours !== undefined ? (
                      <span className="text-xs font-semibold text-foreground">
                        {r.approvedHours}h approved
                      </span>
                    ) : null}
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => onDeleteReview(r.id)}
                        className="text-xs text-red-200 hover:text-red-100"
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
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
    </div>
  );
}

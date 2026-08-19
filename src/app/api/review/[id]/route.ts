import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  devlog,
  peerReview,
  peerReviewDevlogAssessment,
  project,
  projectReviewerAssignment,
  user,
  type DevlogAssessmentDecision,
  type DevlogHackatimeProjectAdjustment,
  type ProjectStatus,
  type ReviewDecision,
  type UserRole,
} from "@/db/schema";
import {
  assessmentDeflatesHours,
  assessmentSecondsToApprovedHours,
  effectiveSecondsForAssessment,
  isValidAssessmentDecision,
  maxAdjustableSeconds,
  sumHackatimeAdjustmentSeconds,
} from "@/lib/devlog-assessments";
import { listProjectHackatimeProjects, reviewableDevlogWhere } from "@/lib/devlogs";
import { getServerSession } from "@/lib/server-session";
import { sendReviewEmail } from "@/lib/loops";
import { appendReviewAudit } from "@/lib/review-audit";
import {
  approvedHoursWithinSnapshot,
  isApprovedHourIncrement,
  normalizeSnapshotSeconds,
  normalizeApprovedHours,
  validateRequiredReviewJustification,
  REVIEW_DEFLATION_REASON_OPTIONS,
  type ReviewJustificationPayload,
} from "@/lib/review-rules";
import {
  parseConsideredHackatimeRange,
  toUtcBoundaryDate,
  type ConsideredHackatimeRange,
} from "@/lib/hackatime-range";
import {
  fetchHackatimeProjectTotalSecondsForInstantRange,
  loadDevlogHackatimeBreakdown,
  refreshHackatimeProjectSnapshotForRange,
} from "@/lib/hackatime";
import { notifyReviewDM } from "@/lib/slack";
import {
  AI_SLOP_REJECTION_MESSAGE,
  UNCLEAR_README_REJECTION_MESSAGE,
} from "@/lib/review/config";

type ReviewBody = {
  decision?: unknown;
  comment?: unknown;
  approvedHours?: unknown;
  reviewJustification?: unknown;
  consideredHackatimeRange?: unknown;
  dismiss?: unknown;
  dismissReason?: unknown;
  devlogAssessments?: unknown;
  /**
   * One-click rejection categories ("ai-slop", "unclear-readme"). When set,
   * the rejection is recorded with a structured cause and — if the reviewer
   * didn't write a comment — the program's canned, creator-friendly message
   * is used as the comment.
   */
  rejectionCategory?: unknown;
  /**
   * Pass-1 reviewer's optional draft of the human-written "Specific Technical
   * Features" hours justification (YSWS Handbook). The granting admin edits
   * and finalizes it at pass 2.
   */
  specificTechnicalFeatures?: unknown;
};

const REJECTION_CATEGORY_MESSAGES: Record<string, string> = {
  "ai-slop": AI_SLOP_REJECTION_MESSAGE,
  "unclear-readme": UNCLEAR_README_REJECTION_MESSAGE,
};

type ParsedAssessmentInput = {
  devlogId: string;
  decision: DevlogAssessmentDecision;
  adjustedSeconds: number | null;
  hackatimeAdjustments: DevlogHackatimeProjectAdjustment[] | null;
  // Required (>= 1) whenever the assessment deflates the devlog's time.
  deflationReasons: string[];
  // Reviewer-overridden considered window (must lie inside the devlog's own
  // window). The server re-pulls Hackatime for this range itself — client
  // numbers are never trusted — and that pull caps adjustedSeconds.
  reviewedWindow: { startedAt: Date; endedAt: Date } | null;
  comment: string | null;
};

const MAX_HACKATIME_ADJUSTMENT_ENTRIES = 50;

const VALID_DEFLATION_REASON_KEYS = new Set<string>(
  REVIEW_DEFLATION_REASON_OPTIONS.map((option) => option.key),
);

/** undefined => invalid payload; null => none provided. */
function parseReviewedWindow(value: unknown): { startedAt: Date; endedAt: Date } | null | undefined {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const { startedAt, endedAt } = value as Record<string, unknown>;
  if (typeof startedAt !== "string" || typeof endedAt !== "string") return undefined;
  const start = new Date(startedAt);
  const end = new Date(endedAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return undefined;
  if (end.getTime() <= start.getTime()) return undefined;
  return { startedAt: start, endedAt: end };
}

/** undefined => invalid payload; [] => none provided. */
function parseAssessmentDeflationReasons(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return undefined;
  const unique = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string" || !VALID_DEFLATION_REASON_KEYS.has(item)) return undefined;
    unique.add(item);
  }
  return Array.from(unique);
}

function parseHackatimeAdjustments(value: unknown): DevlogHackatimeProjectAdjustment[] | null | undefined {
  // undefined => invalid payload; null => not provided
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_HACKATIME_ADJUSTMENT_ENTRIES) {
    return undefined;
  }
  const seen = new Set<string>();
  const out: DevlogHackatimeProjectAdjustment[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return undefined;
    const { name, seconds } = item as Record<string, unknown>;
    if (typeof name !== "string" || !name.trim()) return undefined;
    const key = name.trim().toLowerCase();
    if (seen.has(key)) return undefined;
    seen.add(key);
    const raw = typeof seconds === "number" ? seconds : NaN;
    if (!Number.isFinite(raw) || raw < 0) return undefined;
    out.push({ name: name.trim(), seconds: Math.max(0, Math.floor(raw)) });
  }
  return out;
}

function parseDevlogAssessments(value: unknown): ParsedAssessmentInput[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) return null;
  const out: ParsedAssessmentInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const {
      devlogId,
      decision,
      adjustedSeconds,
      hackatimeAdjustments,
      deflationReasons,
      reviewedWindow,
      comment,
    } = item as Record<string, unknown>;
    if (typeof devlogId !== "string" || !devlogId.trim()) return null;
    if (!isValidAssessmentDecision(decision)) return null;
    const parsedDeflationReasons = parseAssessmentDeflationReasons(deflationReasons);
    if (parsedDeflationReasons === undefined) return null;
    const parsedReviewedWindow = parseReviewedWindow(reviewedWindow);
    if (parsedReviewedWindow === undefined) return null;
    // A reviewed window only makes sense on an adjusted assessment, and not
    // combined with per-project splits (those are scoped to the original window).
    if (parsedReviewedWindow && decision !== "adjusted") return null;
    if (
      parsedReviewedWindow &&
      Array.isArray(hackatimeAdjustments) &&
      hackatimeAdjustments.length > 0
    ) {
      return null;
    }
    let adj: number | null = null;
    let perProject: DevlogHackatimeProjectAdjustment[] | null = null;
    if (decision === "adjusted") {
      const raw =
        typeof adjustedSeconds === "number"
          ? adjustedSeconds
          : typeof adjustedSeconds === "string"
            ? Number(adjustedSeconds)
            : NaN;
      if (!Number.isFinite(raw) || raw < 0) return null;
      adj = Math.max(0, Math.floor(raw));
      const parsedPerProject = parseHackatimeAdjustments(hackatimeAdjustments);
      if (parsedPerProject === undefined) return null;
      perProject = parsedPerProject;
    } else {
      if (adjustedSeconds !== undefined && adjustedSeconds !== null) return null;
      if (hackatimeAdjustments !== undefined && hackatimeAdjustments !== null) return null;
    }
    let cmt: string | null = null;
    if (typeof comment === "string") {
      const t = comment.trim();
      if (t) cmt = t.slice(0, 2000);
    }
    out.push({
      devlogId: devlogId.trim(),
      decision,
      adjustedSeconds: adj,
      hackatimeAdjustments: perProject,
      deflationReasons: parsedDeflationReasons,
      reviewedWindow: parsedReviewedWindow,
      comment: cmt,
    });
  }
  return out;
}

const DISMISS_REASON_MAX_LENGTH = 2000;

function canReview(role: unknown): role is Extract<UserRole, "reviewer" | "admin"> {
  return role === "reviewer" || role === "admin";
}

function isDecision(value: unknown): value is ReviewDecision {
  return value === "approved" || value === "rejected" || value === "comment";
}

function toCleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nextStatusForDecision(decision: ReviewDecision): ProjectStatus | null {
  if (decision === "approved") return "shipped";
  if (decision === "rejected") return "work-in-progress";
  return null; // comment: keep current status
}

function mapReviewJustificationToStructuredColumns(
  justification: ReviewJustificationPayload | null,
) {
  return {
    reviewEvidenceChecklist: justification?.evidence ?? {},
    reviewedHackatimeRangeStart: justification
      ? toUtcBoundaryDate(justification.reviewDateRange.startDate, "start")
      : null,
    reviewedHackatimeRangeEnd: justification
      ? toUtcBoundaryDate(justification.reviewDateRange.endDate, "end")
      : null,
    hourAdjustmentReasonMetadata: justification
      ? {
          decision: justification.decision,
          hackatimeProjectName: justification.hackatimeProjectName,
          reduced: justification.deflation.reduced,
          hoursReducedBy: justification.deflation.hoursReducedBy,
          reasons: justification.deflation.reasons,
          note: justification.deflation.note,
          reasonRequired: justification.deflation.reasonRequired,
        }
      : {},
  };
}

class ReviewSubmitError extends Error {
  code: "not_found" | "stale" | "validation";
  status: number;

  constructor(code: "not_found" | "stale" | "validation", message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: unknown } | undefined)?.role;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canReview(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: projectId } = await ctx.params;

  let body: ReviewBody;
  try {
    body = (await req.json()) as ReviewBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const decision = body.decision;
  if (!isDecision(decision)) {
    return NextResponse.json(
      { error: "Invalid decision. Allowed: approved, rejected, comment" },
      { status: 400 },
    );
  }

  const rejectionCategoryRaw = toCleanString(body.rejectionCategory);
  let rejectionCategory: string | null = null;
  if (rejectionCategoryRaw) {
    if (decision !== "rejected") {
      return NextResponse.json(
        { error: "rejectionCategory is only valid when rejecting." },
        { status: 400 },
      );
    }
    if (!(rejectionCategoryRaw in REJECTION_CATEGORY_MESSAGES)) {
      return NextResponse.json({ error: "Invalid rejectionCategory." }, { status: 400 });
    }
    rejectionCategory = rejectionCategoryRaw;
  }

  // One-click category rejections fall back to the program's canned,
  // creator-friendly message when the reviewer doesn't add their own words.
  let comment = toCleanString(body.comment);
  if (!comment && rejectionCategory) {
    comment = REJECTION_CATEGORY_MESSAGES[rejectionCategory];
  }
  if (!comment) {
    return NextResponse.json({ error: "Comment is required" }, { status: 400 });
  }

  const specificTechnicalFeatures = toCleanString(body.specificTechnicalFeatures).slice(0, 4000) || null;

  const parsedAssessments = parseDevlogAssessments(body.devlogAssessments);
  if (body.devlogAssessments !== undefined && parsedAssessments === null) {
    return NextResponse.json(
      { error: "Invalid devlogAssessments payload." },
      { status: 400 },
    );
  }

  const approvedHoursRaw = body.approvedHours;
  let approvedHours =
    approvedHoursRaw === null || approvedHoursRaw === undefined
      ? null
      : typeof approvedHoursRaw === "number"
        ? approvedHoursRaw
        : typeof approvedHoursRaw === "string"
          ? Number(approvedHoursRaw)
          : NaN;

  if (decision === "approved") {
    if (!parsedAssessments || parsedAssessments.length === 0) {
      if (!Number.isFinite(approvedHours)) {
        return NextResponse.json(
          {
            error:
              "Approving now requires per-devlog assessments. Accept, adjust, or reject each devlog.",
          },
          { status: 400 },
        );
      }
    }
    if (Number.isFinite(approvedHours)) {
      if (approvedHours! <= 0) {
        return NextResponse.json(
          { error: "Approved hours must be greater than 0" },
          { status: 400 },
        );
      }
      if (!isApprovedHourIncrement(approvedHours!)) {
        return NextResponse.json(
          { error: "Approved hours must be in 0.1-hour increments" },
          { status: 400 },
        );
      }
      approvedHours = normalizeApprovedHours(approvedHours);
    }
  }

  const dismiss = body.dismiss === true;
  let dismissReason: string | null = null;
  if (dismiss) {
    if (decision !== "rejected") {
      return NextResponse.json(
        { error: "Dismiss is only available when rejecting a project.", code: "dismiss_requires_rejection" },
        { status: 400 },
      );
    }
    if (role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can dismiss a project.", code: "dismiss_requires_admin" },
        { status: 403 },
      );
    }
    const rawReason = toCleanString(body.dismissReason);
    if (!rawReason) {
      return NextResponse.json(
        {
          error: "Please provide a reason that will be shown to the creator.",
          code: "dismiss_requires_reason",
        },
        { status: 400 },
      );
    }
    if (rawReason.length > DISMISS_REASON_MAX_LENGTH) {
      return NextResponse.json(
        {
          error: `Dismissal reason is too long (max ${DISMISS_REASON_MAX_LENGTH} characters).`,
          code: "dismiss_reason_too_long",
        },
        { status: 400 },
      );
    }
    dismissReason = rawReason;
  }

  const now = new Date();
  const reviewId = randomUUID();
  const statusUpdate = nextStatusForDecision(decision);
  const requestedRangeOverride = body.consideredHackatimeRange;

  let consideredHackatimeRange: ConsideredHackatimeRange | null = null;
  if (requestedRangeOverride !== undefined && requestedRangeOverride !== null) {
    if (role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can override the considered Hackatime range on approval." },
        { status: 403 },
      );
    }
    if (decision !== "approved") {
      return NextResponse.json(
        { error: "Considered Hackatime range overrides are only supported on approvals." },
        { status: 400 },
      );
    }
    const parsedRange = parseConsideredHackatimeRange(requestedRangeOverride);
    if (!parsedRange.ok) {
      return NextResponse.json({ error: parsedRange.error }, { status: 400 });
    }
    consideredHackatimeRange = parsedRange.value;
  }

  // When any devlog is adjusted, precompute the per-devlog Hackatime breakdown so
  // per-project adjustments — and totals above the recorded duration — are
  // validated against the admin timeline instead of client-supplied numbers.
  // The upstream fetches happen here, outside the transaction.
  type DevlogBreakdownInfo = {
    secondsByProjectKey: Map<string, number>;
    totalSeconds: number;
  };
  const breakdownByDevlogId = new Map<string, DevlogBreakdownInfo>();
  if (parsedAssessments?.some((a) => a.decision === "adjusted")) {
    const breakdownProjectRows = await db
      .select({
        creatorId: project.creatorId,
        hackatimeStartedAt: project.hackatimeStartedAt,
        hackatimeStoppedAt: project.hackatimeStoppedAt,
      })
      .from(project)
      .where(eq(project.id, projectId))
      .limit(1);
    const breakdownProject = breakdownProjectRows[0];
    if (breakdownProject) {
      const breakdownDevlogs = await db
        .select({ id: devlog.id, startedAt: devlog.startedAt, endedAt: devlog.endedAt })
        .from(devlog)
        .where(
          reviewableDevlogWhere(projectId, {
            start: breakdownProject.hackatimeStartedAt,
            end: breakdownProject.hackatimeStoppedAt,
          }),
        );
      const linkedProjects = await listProjectHackatimeProjects(projectId);
      const breakdown = await loadDevlogHackatimeBreakdown({
        carnivalUserId: breakdownProject.creatorId ?? null,
        linkedProjectNames: linkedProjects.map((lp) => lp.name),
        devlogs: breakdownDevlogs,
      });
      if (breakdown.configured && !breakdown.error) {
        for (const [devlogId, entries] of Object.entries(breakdown.byDevlog)) {
          const secondsByProjectKey = new Map<string, number>();
          let totalSeconds = 0;
          for (const entry of entries) {
            const seconds = Math.max(0, Math.floor(entry.seconds || 0));
            secondsByProjectKey.set(entry.name.trim().toLowerCase(), seconds);
            totalSeconds += seconds;
          }
          breakdownByDevlogId.set(devlogId, { secondsByProjectKey, totalSeconds });
        }
      }
    }
  }

  // Reviewer-overridden considered windows: validate each against its
  // devlog's own window and re-pull Hackatime for exactly that range (same
  // fetch devlogs use to capture their hours). Upstream fetches happen here,
  // outside the transaction; the pulled seconds — never the client's number —
  // cap the assessment and are stored for the justification.
  type ReviewedWindowInfo = { startedAt: Date; endedAt: Date; windowSeconds: number };
  const reviewedWindowByDevlogId = new Map<string, ReviewedWindowInfo>();
  const windowedAssessments = (parsedAssessments ?? []).filter((a) => a.reviewedWindow);
  if (windowedAssessments.length > 0) {
    const windowProjectRows = await db
      .select({ creatorId: project.creatorId, hackatimeProjectName: project.hackatimeProjectName })
      .from(project)
      .where(eq(project.id, projectId))
      .limit(1);
    const windowProject = windowProjectRows[0];
    if (!windowProject?.creatorId) {
      return NextResponse.json(
        { error: "Project has no creator; cannot re-pull Hackatime for reviewed windows." },
        { status: 409 },
      );
    }
    const windowDevlogRows = await db
      .select({
        id: devlog.id,
        startedAt: devlog.startedAt,
        endedAt: devlog.endedAt,
        hackatimeProjectNameSnapshot: devlog.hackatimeProjectNameSnapshot,
      })
      .from(devlog)
      .where(
        inArray(
          devlog.id,
          windowedAssessments.map((a) => a.devlogId),
        ),
      );
    const windowDevlogById = new Map(windowDevlogRows.map((d) => [d.id, d]));

    for (const a of windowedAssessments) {
      const row = windowDevlogById.get(a.devlogId);
      const window = a.reviewedWindow as { startedAt: Date; endedAt: Date };
      if (!row) {
        return NextResponse.json(
          { error: `Reviewed window references unknown devlog ${a.devlogId}.` },
          { status: 400 },
        );
      }
      // The override must stay inside the devlog's own attested window — a
      // reviewer trims overlap, they don't extend what the devlog claims.
      if (
        window.startedAt.getTime() < row.startedAt.getTime() ||
        window.endedAt.getTime() > row.endedAt.getTime()
      ) {
        return NextResponse.json(
          {
            error:
              "The reviewed window must lie inside the devlog's own time range. Trim the overlap; don't extend the window.",
          },
          { status: 400 },
        );
      }
      const projectName =
        row.hackatimeProjectNameSnapshot.trim() || windowProject.hackatimeProjectName.trim();
      if (!projectName) {
        return NextResponse.json(
          { error: "The devlog has no Hackatime project to re-pull the reviewed window from." },
          { status: 400 },
        );
      }
      try {
        const { totalSeconds } = await fetchHackatimeProjectTotalSecondsForInstantRange(
          windowProject.creatorId,
          { projectName, startedAt: window.startedAt, endedAt: window.endedAt },
        );
        reviewedWindowByDevlogId.set(a.devlogId, {
          startedAt: window.startedAt,
          endedAt: window.endedAt,
          windowSeconds: Math.max(0, Math.floor(totalSeconds || 0)),
        });
      } catch (error) {
        const message =
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : "Failed to re-pull Hackatime for the reviewed window.";
        return NextResponse.json(
          { error: `Could not verify the reviewed window against Hackatime. ${message}` },
          { status: 400 },
        );
      }
    }
  }

  const txResult = await db
    .transaction(async (tx) => {
      const rows = await tx
        .select({
          id: project.id,
          name: project.name,
          hackatimeProjectName: project.hackatimeProjectName,
          status: project.status,
          creatorId: project.creatorId,
          hackatimeStartedAt: project.hackatimeStartedAt,
          hackatimeStoppedAt: project.hackatimeStoppedAt,
          hackatimeTotalSeconds: project.hackatimeTotalSeconds,
        })
        .from(project)
        .where(eq(project.id, projectId))
        .limit(1);

      const current = rows[0];
      if (!current) {
        throw new ReviewSubmitError("not_found", "Not found", 404);
      }
      if (current.status !== "in-review") {
        throw new ReviewSubmitError("stale", "Project is no longer in review", 409);
      }

      let hackatimeSnapshotSeconds = normalizeSnapshotSeconds(current.hackatimeTotalSeconds ?? null);
      const projectRangeUpdate: Partial<{
        hackatimeStartedAt: Date | null;
        hackatimeStoppedAt: Date | null;
        hackatimeTotalSeconds: number | null;
      }> = {};

      if (decision === "approved" && consideredHackatimeRange) {
        if (!current.creatorId) {
          throw new ReviewSubmitError(
            "validation",
            "Project has no creator; cannot refresh the considered Hackatime range.",
            409,
          );
        }

        try {
          const refreshed = await refreshHackatimeProjectSnapshotForRange(current.creatorId, {
            projectName: current.hackatimeProjectName,
            range: consideredHackatimeRange,
          });
          hackatimeSnapshotSeconds = normalizeSnapshotSeconds(refreshed.hackatimeTotalSeconds);
          projectRangeUpdate.hackatimeStartedAt = refreshed.hackatimeStartedAt;
          projectRangeUpdate.hackatimeStoppedAt = refreshed.hackatimeStoppedAt;
          projectRangeUpdate.hackatimeTotalSeconds = hackatimeSnapshotSeconds;
        } catch (error) {
          const message =
            error instanceof Error && error.message.trim()
              ? error.message.trim()
              : "Failed to refresh Hackatime for the selected range.";
          throw new ReviewSubmitError(
            "validation",
            `Could not refresh the considered Hackatime range. ${message}`,
            400,
          );
        }
      }

      const projectDevlogs = await tx
        .select({
          id: devlog.id,
          durationSeconds: devlog.durationSeconds,
        })
        .from(devlog)
        .where(
          reviewableDevlogWhere(projectId, {
            start: projectRangeUpdate.hackatimeStartedAt ?? current.hackatimeStartedAt,
            end: projectRangeUpdate.hackatimeStoppedAt ?? current.hackatimeStoppedAt,
          }),
        );

      const devlogSumSeconds = projectDevlogs.reduce(
        (acc, d) => acc + Math.max(0, Math.floor(d.durationSeconds || 0)),
        0,
      );
      const effectiveHackatimeSeconds =
        devlogSumSeconds > 0 ? devlogSumSeconds : hackatimeSnapshotSeconds;

      let derivedApprovedSeconds: number | null = null;
      if (parsedAssessments && parsedAssessments.length > 0) {
        const knownIds = new Set(projectDevlogs.map((d) => d.id));
        const durationLookup = new Map(
          projectDevlogs.map((d) => [d.id, Math.max(0, Math.floor(d.durationSeconds || 0))]),
        );

        const seenAssessmentIds = new Set<string>();
        for (const a of parsedAssessments) {
          if (!knownIds.has(a.devlogId)) {
            throw new ReviewSubmitError(
              "validation",
              `Assessment references unknown devlog ${a.devlogId}.`,
              400,
            );
          }
          if (seenAssessmentIds.has(a.devlogId)) {
            throw new ReviewSubmitError(
              "validation",
              `Duplicate assessment for devlog ${a.devlogId}.`,
              400,
            );
          }
          seenAssessmentIds.add(a.devlogId);

          if (a.decision === "adjusted") {
            const base = durationLookup.get(a.devlogId) ?? 0;
            const breakdown = breakdownByDevlogId.get(a.devlogId) ?? null;
            if (a.adjustedSeconds === null) {
              throw new ReviewSubmitError(
                "validation",
                "adjustedSeconds is required when decision='adjusted'.",
                400,
              );
            }
            // A reviewer-overridden window replaces the cap entirely: the
            // server's own Hackatime pull for that window is the most the
            // assessment may count.
            const windowInfo = reviewedWindowByDevlogId.get(a.devlogId) ?? null;
            const maxSeconds = windowInfo
              ? windowInfo.windowSeconds
              : maxAdjustableSeconds({
                  devlogId: a.devlogId,
                  durationSeconds: base,
                  hackatimeBreakdownTotalSeconds: breakdown?.totalSeconds ?? null,
                });
            if (a.adjustedSeconds > maxSeconds) {
              throw new ReviewSubmitError(
                "validation",
                windowInfo
                  ? "adjustedSeconds cannot exceed the Hackatime time logged in the reviewed window."
                  : "adjustedSeconds cannot exceed the Hackatime time logged in the devlog window.",
                400,
              );
            }
            if (a.hackatimeAdjustments) {
              if (!breakdown) {
                throw new ReviewSubmitError(
                  "validation",
                  "Per-project adjustments are unavailable — the Hackatime breakdown could not be loaded for this devlog.",
                  400,
                );
              }
              for (const entry of a.hackatimeAdjustments) {
                const cap = breakdown.secondsByProjectKey.get(entry.name.trim().toLowerCase());
                if (cap === undefined) {
                  throw new ReviewSubmitError(
                    "validation",
                    `Adjustment references Hackatime project "${entry.name}", which does not contribute to this devlog.`,
                    400,
                  );
                }
                if (entry.seconds > cap) {
                  throw new ReviewSubmitError(
                    "validation",
                    `Adjusted time for Hackatime project "${entry.name}" exceeds its logged time in this devlog window.`,
                    400,
                  );
                }
              }
              if (sumHackatimeAdjustmentSeconds(a.hackatimeAdjustments) !== a.adjustedSeconds) {
                throw new ReviewSubmitError(
                  "validation",
                  "Per-project adjustments must sum to the devlog's adjusted seconds.",
                  400,
                );
              }
            }
          }

          // Deflation is tied to the devlog's time range: any assessment that
          // counts fewer seconds than the devlog logged must say why, right
          // here — there is no generic project-level deflation reason anymore.
          // These entries become the per-devlog deflation breakdown in the
          // Airtable hours justification.
          const deflates = assessmentDeflatesHours(
            {
              devlogId: a.devlogId,
              durationSeconds: durationLookup.get(a.devlogId) ?? 0,
              hackatimeBreakdownTotalSeconds:
                breakdownByDevlogId.get(a.devlogId)?.totalSeconds ?? null,
            },
            { decision: a.decision, adjustedSeconds: a.adjustedSeconds ?? null },
          );
          if (deflates && a.deflationReasons.length === 0) {
            throw new ReviewSubmitError(
              "validation",
              "Select at least one deflation reason on every devlog whose hours you reduced or rejected.",
              400,
            );
          }
          if (deflates && !a.comment) {
            throw new ReviewSubmitError(
              "validation",
              "Add a note on every devlog whose hours you reduced or rejected — each deflation needs a human-written justification for its time range.",
              400,
            );
          }
        }

        if (decision === "approved") {
          if (seenAssessmentIds.size !== projectDevlogs.length) {
            throw new ReviewSubmitError(
              "validation",
              "Every devlog must be assessed (accepted, rejected, or adjusted) before approval.",
              400,
            );
          }
        }

        let totalSeconds = 0;
        for (const a of parsedAssessments) {
          // For windowed assessments the reviewed window's Hackatime pull is
          // the ceiling, so pass it as the breakdown total to keep
          // effectiveSecondsForAssessment's clamp consistent with maxSeconds.
          const windowInfo = reviewedWindowByDevlogId.get(a.devlogId) ?? null;
          totalSeconds += effectiveSecondsForAssessment(
            {
              devlogId: a.devlogId,
              durationSeconds: durationLookup.get(a.devlogId) ?? 0,
              hackatimeBreakdownTotalSeconds: windowInfo
                ? windowInfo.windowSeconds
                : breakdownByDevlogId.get(a.devlogId)?.totalSeconds ?? null,
            },
            { decision: a.decision, adjustedSeconds: a.adjustedSeconds ?? null },
          );
        }
        derivedApprovedSeconds = totalSeconds;

        if (decision === "approved") {
          const derivedHours = assessmentSecondsToApprovedHours(totalSeconds);
          if (!Number.isFinite(approvedHours) && derivedHours <= 0) {
            throw new ReviewSubmitError(
              "validation",
              "Assessed devlog hours total less than 0.1h; approving is not possible.",
              400,
            );
          }
          if (!Number.isFinite(approvedHours)) {
            approvedHours = derivedHours;
          }
        }

      }

      // Assessed totals may exceed the devlog-duration sum when adjusted devlogs
      // count contributions from additional linked Hackatime projects, so the
      // approval ceiling considers both.
      const approvedHoursCapSeconds = Math.max(
        effectiveHackatimeSeconds,
        derivedApprovedSeconds ?? 0,
      );

      if (decision === "approved") {
        if (!Number.isFinite(approvedHours)) {
          throw new ReviewSubmitError(
            "validation",
            "Could not determine approved hours. Assess every devlog.",
            400,
          );
        }
        if (!approvedHoursWithinSnapshot(approvedHours as number, approvedHoursCapSeconds)) {
          throw new ReviewSubmitError(
            "validation",
            "Approved hours cannot exceed captured Hackatime at review time",
            400,
          );
        }
      }

      const normalizedReviewJustification =
        decision === "comment"
          ? null
          : decision === "rejected" && (body.reviewJustification === null || body.reviewJustification === undefined)
            ? null
            : (() => {
              const validated = validateRequiredReviewJustification({
                value: body.reviewJustification,
                decision,
                expectedHackatimeProjectName: current.hackatimeProjectName,
                approvedHours: decision === "approved" ? (approvedHours as number) : null,
                loggedHackatimeHours: approvedHoursCapSeconds / 3600,
              });
              if (!validated.ok) {
                throw new ReviewSubmitError("validation", validated.error, 400);
              }
              return validated.value;
            })();

      const structuredReviewColumns =
        mapReviewJustificationToStructuredColumns(normalizedReviewJustification);

      const reviewInsertValues: typeof peerReview.$inferInsert = {
        id: reviewId,
        projectId,
        reviewerId: userId,
        decision,
        reviewComment: comment,
        approvedHours: decision === "approved" ? (approvedHours as number) : null,
        hackatimeSnapshotSeconds,
        createdAt: now,
        updatedAt: now,
        reviewEvidenceChecklist: structuredReviewColumns.reviewEvidenceChecklist,
        reviewedHackatimeRangeStart: structuredReviewColumns.reviewedHackatimeRangeStart,
        reviewedHackatimeRangeEnd: structuredReviewColumns.reviewedHackatimeRangeEnd,
        hourAdjustmentReasonMetadata: structuredReviewColumns.hourAdjustmentReasonMetadata,
        specificTechnicalFeatures: decision === "approved" ? specificTechnicalFeatures : null,
        rejectionCategory,
      };

      const inserted = (await tx
        .insert(peerReview)
        .values(reviewInsertValues)
        .returning({
          id: peerReview.id,
          decision: peerReview.decision,
          reviewComment: peerReview.reviewComment,
          approvedHours: peerReview.approvedHours,
          hackatimeSnapshotSeconds: peerReview.hackatimeSnapshotSeconds,
          createdAt: peerReview.createdAt,
        })) as Array<{
        id: string;
        decision: ReviewDecision;
        reviewComment: string;
        approvedHours: number | null;
        hackatimeSnapshotSeconds: number;
        createdAt: Date;
      }>;

      if (parsedAssessments && parsedAssessments.length > 0) {
        await tx
          .delete(peerReviewDevlogAssessment)
          .where(eq(peerReviewDevlogAssessment.reviewId, reviewId));

        await tx.insert(peerReviewDevlogAssessment).values(
          parsedAssessments.map((a) => {
            const windowInfo = reviewedWindowByDevlogId.get(a.devlogId) ?? null;
            return {
              id: randomUUID(),
              reviewId,
              devlogId: a.devlogId,
              decision: a.decision,
              adjustedSeconds: a.decision === "adjusted" ? a.adjustedSeconds ?? null : null,
              hackatimeProjectAdjustments:
                a.decision === "adjusted" && a.hackatimeAdjustments ? a.hackatimeAdjustments : [],
              deflationReasons: a.deflationReasons,
              reviewedStartedAt: windowInfo?.startedAt ?? null,
              reviewedEndedAt: windowInfo?.endedAt ?? null,
              reviewedWindowSeconds: windowInfo?.windowSeconds ?? null,
              comment: a.comment,
              createdAt: now,
            };
          }),
        );
      }

      const updateSet =
        decision === "approved"
          ? ({
              status: "shipped",
              approvedHours: approvedHours as number,
              updatedAt: now,
              ...projectRangeUpdate,
            } as const)
          : decision === "rejected"
            ? ({
                status: "work-in-progress",
                approvedHours: null,
                updatedAt: now,
                ...(dismiss
                  ? {
                      resubmissionBlocked: true,
                      resubmissionBlockedAt: now,
                      resubmissionBlockedBy: userId,
                      resubmissionBlockedReason: dismissReason,
                    }
                  : {}),
              } as const)
            : ({ updatedAt: now } as const);

      const updated = await tx
        .update(project)
        .set(updateSet)
        .where(and(eq(project.id, projectId), eq(project.status, "in-review")))
        .returning({
          id: project.id,
          name: project.name,
          creatorId: project.creatorId,
          status: project.status,
          approvedHours: project.approvedHours,
          hackatimeStartedAt: project.hackatimeStartedAt,
          hackatimeStoppedAt: project.hackatimeStoppedAt,
          hackatimeTotalSeconds: project.hackatimeTotalSeconds,
        });

      if (updated.length === 0) {
        throw new ReviewSubmitError(
          "stale",
          "Project changed while submitting review. Refresh and try again.",
          409,
        );
      }

      if (statusUpdate) {
        await tx.delete(projectReviewerAssignment).where(eq(projectReviewerAssignment.projectId, projectId));
      }

      await appendReviewAudit(
        {
          projectId,
          reviewId,
          actorId: userId,
          actorRole: role,
          action: "review_submitted",
          details: {
            decision,
            approvedHours: decision === "approved" ? (approvedHours as number) : null,
            statusAfter: updated[0]?.status ?? "in-review",
            hackatimeSnapshotSeconds,
            consideredHackatimeRange,
            reviewJustification: normalizedReviewJustification,
            dismissed: dismiss,
            ...(dismiss ? { dismissReason } : {}),
          },
          at: now,
        },
        tx,
      );

      return {
        project: updated[0]!,
        review: inserted[0]!,
        reviewJustification: normalizedReviewJustification,
      };
    })
    .catch((error: unknown) => {
      if (error instanceof ReviewSubmitError) {
        return { handledError: error };
      }
      throw error;
    });

  if ("handledError" in txResult) {
    return NextResponse.json({ error: txResult.handledError.message }, { status: txResult.handledError.status });
  }

  // Best-effort: notify the project creator about the review outcome.
  // Only reviewer/admin users can reach this route (enforced above by canReview()).
  //
  // IMPORTANT: an approval here is only PASS 1 of the two-pass review — an
  // admin still reviews everything on the granting page (pass 2) before
  // anything is final. The creator therefore gets NO notification on pass-1
  // approval (their dashboard just shows the status change); the "approved +
  // tokens granted" email is sent by the grant flow. Rejections and plain
  // comments still notify immediately.
  try {
    if (decision !== "approved" && txResult.project.creatorId) {
      const creatorRows = await db
        .select({ email: user.email, slackId: user.slackId })
        .from(user)
        .where(eq(user.id, txResult.project.creatorId))
        .limit(1);

      const creatorEmail = creatorRows[0]?.email;
      const creatorSlackId = creatorRows[0]?.slackId;
      if (creatorEmail) {
        const reviewerName = (session?.user as { name?: string | null } | undefined)?.name ?? "Reviewer";

        const decisionPrefix =
          decision === "comment" ? "" : dismiss ? "Rejected and dismissed: " : "Rejected: ";

        const dismissNote = dismiss
          ? `\n\nAn admin has dismissed this project, so it cannot be resubmitted for review.${
              dismissReason ? `\n\nReason from admin: ${dismissReason}` : ""
            }\n\nIf you believe this was a mistake, contact an organizer.`
          : "";
        const updates = `${decisionPrefix}${comment}${dismissNote}`;

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
        let project_link = `/projects/${projectId}`;
        if (appUrl) {
          try {
            project_link = new URL(`/projects/${projectId}`, appUrl).toString();
          } catch {
            // If appUrl isn't a valid absolute URL, fall back to relative.
          }
        }

        // Email is best-effort; failures shouldn’t block Slack DM.
        await sendReviewEmail(creatorEmail, updates, reviewerName, project_link).catch((err) => {
          console.warn("sendReviewEmail failed", err);
        });

        if (creatorSlackId) {
          const reviewerSlack = await db
            .select({ slackId: user.slackId })
            .from(user)
            .where(eq(user.id, userId))
            .limit(1);

          const reviewerSlackId = reviewerSlack[0]?.slackId ?? undefined;
          const statusLabel: "submitted" | "approved" | "rejected" | "comment" | "shipped" =
            decision === "comment" ? "comment" : decision;
          const slackComment = dismiss
            ? `${comment}\n\nAn admin has dismissed this project, so it cannot be resubmitted for review.${
                dismissReason ? `\n\nReason from admin: ${dismissReason}` : ""
              }`
            : comment;
          await notifyReviewDM({
            slackId: creatorSlackId,
            projectName: txResult.project.name,
            status: statusLabel,
            comment: slackComment,
            projectUrl: project_link,
            reviewerSlackId,
            reviewerName: reviewerName,
            reviewerId: userId,
            creatorSlackId: creatorSlackId,
          });
        }
      }
    }
  } catch (err) {
    console.error("Failed to send review email/Slack DM", err);
  }

  return NextResponse.json({
    project: {
      status: txResult.project.status,
      approvedHours: txResult.project.approvedHours ?? null,
      hackatimeStartedAt: txResult.project.hackatimeStartedAt
        ? txResult.project.hackatimeStartedAt.toISOString()
        : null,
      hackatimeStoppedAt: txResult.project.hackatimeStoppedAt
        ? txResult.project.hackatimeStoppedAt.toISOString()
        : null,
      hackatimeTotalSeconds: txResult.project.hackatimeTotalSeconds ?? null,
    },
    review: {
      id: txResult.review.id ?? reviewId,
      decision: txResult.review.decision ?? decision,
      reviewComment: txResult.review.reviewComment ?? comment,
      approvedHours:
        txResult.review.approvedHours ?? (decision === "approved" ? (approvedHours as number) : null),
      hackatimeSnapshotSeconds: txResult.review.hackatimeSnapshotSeconds,
      reviewJustification: txResult.reviewJustification ?? null,
      createdAt: (txResult.review.createdAt ?? now).toISOString(),
      reviewerName: (session?.user as { name?: string | null } | undefined)?.name ?? "Reviewer",
      reviewerEmail: (session?.user as { email?: string | null } | undefined)?.email ?? "",
    },
  });
}

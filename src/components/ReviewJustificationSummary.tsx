import {
  REVIEW_DEFLATION_REASON_OPTIONS,
  REVIEW_EVIDENCE_ITEMS,
  type ReviewJustificationPayload,
} from "@/lib/review-rules";
import { formatDateOnlyForDisplay } from "@/lib/hackatime-range";

const DEFLATION_REASON_LABELS = new Map(
  REVIEW_DEFLATION_REASON_OPTIONS.map((option) => [option.key, option.label]),
);

export default function ReviewJustificationSummary({
  justification,
}: {
  justification: ReviewJustificationPayload;
}) {
  const reviewRangeLabel = `${formatDateOnlyForDisplay(
    justification.reviewDateRange.startDate,
  )} - ${formatDateOnlyForDisplay(
    justification.reviewDateRange.endDate,
  )}`;
  const reduced =
    justification.decision === "approved" && justification.deflation.reduced;
  const reasons = reduced
    ? justification.deflation.reasons.map((reason) => DEFLATION_REASON_LABELS.get(reason) ?? reason)
    : [];

  return (
    <div className="mt-3 rounded-xl border border-border bg-background px-3 py-3 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Hackatime project reviewed
          </div>
          <div className="text-sm text-foreground font-semibold">
            <span className="font-mono">{justification.hackatimeProjectName}</span>
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Review range
          </div>
          <div className="text-sm text-foreground font-semibold">{reviewRangeLabel}</div>
        </div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Evidence checks
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {REVIEW_EVIDENCE_ITEMS.map((item) => (
            <span
              key={item.key}
              className={[
                "inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide",
                justification.evidence[item.key]
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-carnival-red/15 text-red-200",
              ].join(" ")}
            >
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {reduced ? (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Hours deflation rationale
          </div>
          <div className="text-sm text-foreground">
            Reduced by <span className="font-semibold">{justification.deflation.hoursReducedBy.toFixed(2)}h</span>
          </div>
          {reasons.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {reasons.map((reason) => (
                <span
                  key={reason}
                  className="inline-flex rounded-full bg-carnival-red/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-red-200"
                >
                  {reason}
                </span>
              ))}
            </div>
          ) : null}
          {justification.deflation.note ? (
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">
              {justification.deflation.note}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

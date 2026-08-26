import {
  REVIEW_DEFLATION_REASON_OPTIONS,
  REVIEW_EVIDENCE_ITEMS,
  type ReviewJustificationPayload,
} from "@/lib/review-rules";
import { PlatformNestedSurface } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
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
    <PlatformNestedSurface className="mt-3 px-3 py-3 space-y-3">
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
            <Badge
              key={item.key}
              variant={justification.evidence[item.key] ? "success" : "error"}
            >
              {item.label}
            </Badge>
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
                <Badge key={reason} variant="error">
                  {reason}
                </Badge>
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
    </PlatformNestedSurface>
  );
}

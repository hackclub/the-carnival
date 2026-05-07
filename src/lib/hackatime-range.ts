export type ConsideredHackatimeRange = {
  startDate: string;
  endDate: string;
};

const ISO_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export function isIsoDateOnly(value: string) {
  if (!ISO_DATE_ONLY_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return parsed.toISOString().slice(0, 10) === value;
}

export function isDatetimeLocal(value: string) {
  if (!DATETIME_LOCAL_RE.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

export function isValidRangeDate(value: string) {
  return isIsoDateOnly(value) || isDatetimeLocal(value);
}

export function toIsoDateOnly(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isIsoDateOnly(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function toUtcBoundaryDate(dateStr: string, boundary: "start" | "end") {
  if (isDatetimeLocal(dateStr)) {
    const parsed = new Date(dateStr);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const boundaryTime = boundary === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
  const parsed = new Date(`${dateStr}${boundaryTime}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseConsideredHackatimeRange(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false as const, error: "Select both considered Hackatime start and end dates." };
  }

  const root = input as { startDate?: unknown; endDate?: unknown };
  const startDate = typeof root.startDate === "string" ? root.startDate.trim() : "";
  const endDate = typeof root.endDate === "string" ? root.endDate.trim() : "";

  if (!isValidRangeDate(startDate) || !isValidRangeDate(endDate)) {
    return {
      ok: false as const,
      error: "Select both considered Hackatime start and end dates.",
    };
  }

  const startMs = new Date(isIsoDateOnly(startDate) ? `${startDate}T00:00:00` : startDate).getTime();
  const endMs = new Date(isIsoDateOnly(endDate) ? `${endDate}T23:59:59` : endDate).getTime();
  if (startMs > endMs) {
    return {
      ok: false as const,
      error: "Considered Hackatime range is invalid: start must be before end.",
    };
  }

  return {
    ok: true as const,
    value: {
      startDate,
      endDate,
    } satisfies ConsideredHackatimeRange,
  };
}

export function getProjectConsideredHackatimeRange(input: {
  hackatimeStartedAt?: Date | string | null;
  hackatimeStoppedAt?: Date | string | null;
  submittedAt?: Date | string | null;
  createdAt?: Date | string | null;
}) {
  const startDate =
    toIsoDateOnly(input.hackatimeStartedAt) ??
    toIsoDateOnly(input.submittedAt) ??
    toIsoDateOnly(input.createdAt);
  const endDate =
    toIsoDateOnly(input.hackatimeStoppedAt) ??
    toIsoDateOnly(input.submittedAt) ??
    toIsoDateOnly(input.createdAt);

  if (!startDate || !endDate) return null;
  return parseConsideredHackatimeRange({ startDate, endDate }).ok
    ? ({ startDate, endDate } satisfies ConsideredHackatimeRange)
    : null;
}

export function formatDateOnlyForDisplay(value: string | null | undefined) {
  const dateOnly = typeof value === "string" ? value.trim() : "";
  if (!dateOnly || !isIsoDateOnly(dateOnly)) return "—";
  const parsed = new Date(`${dateOnly}T12:00:00.000Z`);
  return parsed.toLocaleDateString();
}

export function formatConsideredHackatimeRangeLabel(range: ConsideredHackatimeRange | null) {
  if (!range) return "—";
  return `${formatDateOnlyForDisplay(range.startDate)} - ${formatDateOnlyForDisplay(range.endDate)}`;
}

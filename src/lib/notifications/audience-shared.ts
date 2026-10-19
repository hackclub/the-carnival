/**
 * Pure, client-safe definitions for the Messages page's audience filters:
 * a fixed set of filters an admin stacks (AND) to find people, plus presets
 * matching the insights activation segments. The SQL lives in audience.ts.
 */

export const NUMBER_OPS = ["gte", "gt", "eq", "lte", "lt"] as const;
export type NumberOp = (typeof NUMBER_OPS)[number];

export const NUMBER_OP_LABELS: Record<NumberOp, string> = {
  gte: "at least",
  gt: "more than",
  eq: "exactly",
  lte: "at most",
  lt: "fewer than",
};

export const VERIFICATION_VALUES = ["verified", "pending", "needs_submission", "ineligible", "none"] as const;
export type VerificationValue = (typeof VERIFICATION_VALUES)[number];

export const VERIFICATION_LABELS: Record<VerificationValue, string> = {
  verified: "Verified",
  pending: "Pending review",
  needs_submission: "Needs submission",
  ineligible: "Ineligible",
  none: "No status",
};

type NumberFilterDef = { kind: "number"; label: string; unit: "count" | "hours"; help: string };
type BooleanFilterDef = { kind: "boolean"; label: string; yes: string; no: string };
type EnumFilterDef = { kind: "verification"; label: string };
type DateFilterDef = { kind: "date"; label: string };

export const AUDIENCE_FILTERS = {
  projects_created: {
    kind: "number",
    label: "Projects created",
    unit: "count",
    help: "Every project they've made, in any state.",
  },
  projects_submitted: {
    kind: "number",
    label: "Projects submitted",
    unit: "count",
    help: "Projects sent for review at least once (in review, shipped or granted, or submitted before).",
  },
  projects_shipped: {
    kind: "number",
    label: "Projects shipped or granted",
    unit: "count",
    help: "Projects that passed review.",
  },
  approved_hours: {
    kind: "number",
    label: "Approved hours",
    unit: "hours",
    help: "Hours reviewers approved, summed across projects.",
  },
  logged_hours: {
    kind: "number",
    label: "Hours logged",
    unit: "hours",
    help: "Hackatime hours on all their projects.",
  },
  unsubmitted_hours: {
    kind: "number",
    label: "Unsubmitted hours",
    unit: "hours",
    help: "Hours on work-in-progress projects never sent for review.",
  },
  in_review: { kind: "boolean", label: "Has a project in review", yes: "Yes", no: "No" },
  hackatime_connected: { kind: "boolean", label: "Hackatime connected", yes: "Yes", no: "No" },
  verification: { kind: "verification", label: "Identity verification" },
  signed_up: { kind: "date", label: "Signed up" },
} as const satisfies Record<string, NumberFilterDef | BooleanFilterDef | EnumFilterDef | DateFilterDef>;

export type AudienceFilterKey = keyof typeof AUDIENCE_FILTERS;
export const AUDIENCE_FILTER_KEYS = Object.keys(AUDIENCE_FILTERS) as AudienceFilterKey[];

export type NumberFilterKey = {
  [K in AudienceFilterKey]: (typeof AUDIENCE_FILTERS)[K]["kind"] extends "number" ? K : never;
}[AudienceFilterKey];
export type BooleanFilterKey = {
  [K in AudienceFilterKey]: (typeof AUDIENCE_FILTERS)[K]["kind"] extends "boolean" ? K : never;
}[AudienceFilterKey];

export type AudienceFilter =
  | { key: NumberFilterKey; op: NumberOp; value: number }
  | { key: BooleanFilterKey; value: boolean }
  | { key: "verification"; values: VerificationValue[] }
  | { key: "signed_up"; op: "before" | "after"; date: string };

export function isAudienceFilterKey(value: unknown): value is AudienceFilterKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(AUDIENCE_FILTERS, value);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A sensible starting filter when an admin adds one of this key. */
export function defaultFilter(key: AudienceFilterKey): AudienceFilter {
  const def = AUDIENCE_FILTERS[key];
  if (def.kind === "number") return { key: key as NumberFilterKey, op: "gte", value: 1 };
  if (def.kind === "boolean") return { key: key as BooleanFilterKey, value: true };
  if (def.kind === "verification") return { key: "verification", values: ["verified"] };
  return { key: "signed_up", op: "after", date: new Date().toISOString().slice(0, 10) };
}

/** Validate one filter from a request body; null when it's malformed. */
export function parseAudienceFilter(raw: unknown): AudienceFilter | null {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as Record<string, unknown>;
  if (!isAudienceFilterKey(f.key)) return null;
  const def = AUDIENCE_FILTERS[f.key];
  if (def.kind === "number") {
    const value = typeof f.value === "number" ? f.value : Number(f.value);
    if (!(NUMBER_OPS as readonly unknown[]).includes(f.op) || !Number.isFinite(value) || value < 0) return null;
    if (def.unit === "count" && (!Number.isInteger(value) || value > 1_000_000)) return null;
    if (def.unit === "hours" && value > 1_000_000) return null;
    return { key: f.key as NumberFilterKey, op: f.op as NumberOp, value };
  }
  if (def.kind === "boolean") {
    if (typeof f.value !== "boolean") return null;
    return { key: f.key as BooleanFilterKey, value: f.value };
  }
  if (def.kind === "verification") {
    const values = Array.isArray(f.values)
      ? [...new Set(f.values.filter((v): v is VerificationValue => (VERIFICATION_VALUES as readonly unknown[]).includes(v)))]
      : [];
    return values.length ? { key: "verification", values } : null;
  }
  if ((f.op !== "before" && f.op !== "after") || typeof f.date !== "string" || !DATE_RE.test(f.date)) return null;
  if (!Number.isFinite(Date.parse(`${f.date}T00:00:00Z`))) return null;
  return { key: "signed_up", op: f.op, date: f.date };
}

export function parseAudienceFilters(
  raw: unknown,
): { ok: true; filters: AudienceFilter[] } | { ok: false; error: string } {
  if (raw === undefined) return { ok: true, filters: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "filters must be a list" };
  if (raw.length > 20) return { ok: false, error: "Too many filters" };
  const filters: AudienceFilter[] = [];
  for (const item of raw) {
    const parsed = parseAudienceFilter(item);
    if (!parsed) return { ok: false, error: `Invalid filter: ${JSON.stringify(item).slice(0, 120)}` };
    filters.push(parsed);
  }
  return { ok: true, filters };
}

/** Human-readable summary, e.g. "Projects submitted more than 3". */
export function describeFilter(f: AudienceFilter): string {
  const def = AUDIENCE_FILTERS[f.key];
  if ("op" in f && "value" in f) {
    const unit = def.kind === "number" && def.unit === "hours" ? " h" : "";
    return `${def.label} ${NUMBER_OP_LABELS[f.op]} ${f.value}${unit}`;
  }
  if ("value" in f) return `${def.label}: ${f.value ? "yes" : "no"}`;
  if ("values" in f) return `${def.label}: ${f.values.map((v) => VERIFICATION_LABELS[v]).join(" or ")}`;
  return `${def.label} ${f.op === "before" ? "before" : "on or after"} ${f.date}`;
}

/** Ready-made filter sets; the first four match the insights activation segments. */
export const AUDIENCE_PRESETS: { key: string; label: string; description: string; filters: AudienceFilter[] }[] = [
  {
    key: "never_activated",
    label: "Never activated",
    description: "No Hackatime connection and no project.",
    filters: [
      { key: "hackatime_connected", value: false },
      { key: "projects_created", op: "eq", value: 0 },
    ],
  },
  {
    key: "zero_hours",
    label: "Projects, zero hours",
    description: "Created a project but has no hours logged and nothing submitted.",
    filters: [
      { key: "projects_created", op: "gte", value: 1 },
      { key: "projects_submitted", op: "eq", value: 0 },
      { key: "logged_hours", op: "eq", value: 0 },
    ],
  },
  {
    key: "stalled_with_hours",
    label: "Stalled with hours",
    description: "Has hours on a work-in-progress project that was never submitted.",
    filters: [{ key: "unsubmitted_hours", op: "gt", value: 0 }],
  },
  {
    key: "verification_blocked",
    label: "Verification blocked",
    description: "Has a project but identity verification isn't done.",
    filters: [
      { key: "verification", values: ["needs_submission", "pending"] },
      { key: "projects_created", op: "gte", value: 1 },
    ],
  },
  {
    key: "repeat_shippers",
    label: "Shipped more than 3",
    description: "Power users: more than three projects shipped or granted.",
    filters: [{ key: "projects_shipped", op: "gt", value: 3 }],
  },
];

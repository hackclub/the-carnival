import type { ProjectEditor } from "@/db/schema";

export const EDITOR_OPTIONS = [
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
] as const satisfies ReadonlyArray<{ value: ProjectEditor; label: string }>;

export type EditorOptionValue = (typeof EDITOR_OPTIONS)[number]["value"];

export type HackatimeHours = {
  hours: number;
  minutes: number;
};

export type HackatimeProjectOption = {
  name: string;
  startedAt: string | null;
  stoppedAt: string | null;
  totalSeconds: number;
};

export type HackatimeRangePreview = {
  hackatimeStartedAt?: string | null;
  hackatimeStoppedAt?: string | null;
  hackatimeTotalSeconds: number | null;
  hackatimeHours: HackatimeHours | null;
};

export function cleanString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export function cleanList(values: string[]) {
  return values.map((v) => v.trim()).filter(Boolean);
}

export function appendCsvToken(csv: string, token: string) {
  const normalized = token.trim();
  if (!normalized) return csv;
  const parts = csv
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const seen = new Set(parts.map((part) => part.toLowerCase()));
  if (!seen.has(normalized.toLowerCase())) {
    parts.push(normalized);
  }
  return parts.join(", ");
}

export function toDateInputValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function toHoursMinutes(totalSeconds: number | null | undefined): HackatimeHours {
  const safeTotalSeconds =
    typeof totalSeconds === "number" && Number.isFinite(totalSeconds)
      ? Math.max(0, Math.floor(totalSeconds))
      : 0;
  return {
    hours: Math.floor(safeTotalSeconds / 3600),
    minutes: Math.floor(safeTotalSeconds / 60) % 60,
  };
}

export function formatHoursMinutes(hours: number, minutes: number) {
  const safeHours = Number.isFinite(hours) ? Math.max(0, Math.floor(hours)) : 0;
  const safeMinutes = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;
  return `${safeHours}h${String(safeMinutes).padStart(2, "0")}m`;
}

export function formatTotalSeconds(totalSeconds: number | null | undefined) {
  const { hours, minutes } = toHoursMinutes(totalSeconds);
  return formatHoursMinutes(hours, minutes);
}

export function extractApiError(data: unknown, fallback: string) {
  return typeof (data as { error?: unknown } | null)?.error === "string"
    ? (data as { error: string }).error
    : fallback;
}

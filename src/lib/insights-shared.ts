// Client-safe name helpers for nudge copy. insights.ts re-exports these; it
// also imports drizzle, so client components import from here instead.

export function firstNameOf(name: string | null | undefined): string {
  const cleaned = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  const first = cleaned.split(" ")[0] ?? "";
  return first || "there";
}

/** Replace supported placeholders ({firstName}) in a nudge template. */
export function renderNudgeMessage(template: string, user: { name: string | null }): string {
  return template.replaceAll("{firstName}", firstNameOf(user.name));
}

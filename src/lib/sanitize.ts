// Input sanitizers for API boundaries. React escapes everything we render, so
// these are about keeping stored data clean: no control / zero-width / bidi
// characters, bounded lengths, and only http(s) URLs.

// C0/C1 controls except tab (\x09), newline (\x0A) and carriage return (\x0D).
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
// Invisible characters used to spoof text: zero-width space, word joiners,
// BOM, and bidi overrides/isolates. ZWNJ/ZWJ (U+200C/D) and LRM/RLM
// (U+200E/F) are kept on purpose - emoji sequences and several scripts need them.
const INVISIBLE_CHARS = /[\u200B\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

export const TEXT_LIMITS = {
  name: 120,
  shortText: 200,
  reason: 500,
  longText: 5000,
  url: 2048,
} as const;

/**
 * Baseline cleanup for any untrusted string: removes control and invisible
 * spoofing characters, normalizes line endings and trims. It never truncates
 * or collapses whitespace, so routes keep their own length rules. Non-strings
 * become "".
 */
export function cleanUntrustedString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARS, "")
    .replace(INVISIBLE_CHARS, "")
    .trim();
}

/**
 * Normalize untrusted text: strips control and invisible characters, trims,
 * and caps the length. Single-line text also collapses whitespace runs
 * (including newlines) to one space. Non-strings become "".
 */
export function sanitizeText(
  value: unknown,
  options: { maxLength: number; multiline?: boolean },
): string {
  if (typeof value !== "string") return "";
  let text = value.normalize("NFC").replace(CONTROL_CHARS, "").replace(INVISIBLE_CHARS, "");
  if (options.multiline) {
    text = text.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n");
  } else {
    text = text.replace(/\s+/g, " ");
  }
  return text.trim().slice(0, options.maxLength).trim();
}

/**
 * Returns the cleaned URL string, "" for empty input, or null when the value
 * is not a valid http(s) URL (so callers can reject it). The URL is kept as
 * typed rather than re-serialized, so allowlist matching downstream is
 * unaffected.
 */
export function sanitizeHttpUrl(value: unknown): string | null {
  const raw = sanitizeText(value, { maxLength: TEXT_LIMITS.url + 1 });
  if (!raw) return "";
  if (raw.length > TEXT_LIMITS.url || /\s/.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return raw;
  } catch {
    return null;
  }
}

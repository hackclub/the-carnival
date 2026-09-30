import validator from "validator";

// Thin adapter over validator.js (https://github.com/validatorjs/validator.js)
// so API routes share one set of options. React escapes everything we render,
// so this is about keeping stored data clean: no control characters, bounded
// lengths, and only http(s) URLs.

export const TEXT_LIMITS = {
  name: 120,
  shortText: 200,
  reason: 500,
  longText: 5000,
  url: 2048,
} as const;

// validator.stripLow(str, true) also drops tabs; multi-line text (devlogs,
// descriptions) keeps them, so blacklist the same range minus \x09.
const LOW_CHARS_EXCEPT_TAB_AND_NEWLINES = "\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F";

function stripMultiline(value: string) {
  return validator.blacklist(value, LOW_CHARS_EXCEPT_TAB_AND_NEWLINES);
}

/**
 * Baseline cleanup for any untrusted string: removes ASCII control characters
 * (keeping tabs and newlines) and trims. Never truncates, so routes keep their
 * own length rules. Non-strings become "".
 */
export function cleanUntrustedString(value: unknown): string {
  if (typeof value !== "string") return "";
  return validator.trim(stripMultiline(value));
}

/**
 * Cleans untrusted text and caps its length. Single-line text loses every
 * control character, including newlines and tabs. Non-strings become "".
 */
export function sanitizeText(
  value: unknown,
  options: { maxLength: number; multiline?: boolean },
): string {
  if (typeof value !== "string") return "";
  const stripped = options.multiline ? stripMultiline(value) : validator.stripLow(value);
  return validator.trim(validator.trim(stripped).slice(0, options.maxLength));
}

/**
 * Returns the trimmed URL, "" for empty input, or null when it is not a valid
 * http(s) URL (so callers can reject it). The URL is kept as typed rather than
 * re-serialized, so allowlist matching downstream is unaffected.
 */
export function sanitizeHttpUrl(value: unknown): string | null {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return null;
  const raw = validator.trim(value);
  if (!raw) return "";
  const ok = validator.isURL(raw, {
    protocols: ["http", "https"],
    require_protocol: true,
    require_valid_protocol: true,
    disallow_auth: true,
    max_allowed_length: TEXT_LIMITS.url,
  });
  return ok ? raw : null;
}

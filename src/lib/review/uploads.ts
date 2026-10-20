/**
 * Server-side enforcement that images were uploaded THROUGH the platform.
 *
 * Creators cannot paste arbitrary image URLs anywhere (screenshots, preview
 * images, devlog attachments): every stored image URL must point at our own
 * R2 bucket and carry an allowed extension (PNG/JPG/JPEG — set in
 * ./config.ts). This is validated at WRITE time in the API routes, not just
 * at submission, so nothing off-platform can ever be saved.
 *
 * Why: the platform must control the actual bytes a reviewer approves. An
 * external URL can 404 later, be swapped after review, or point at a GIF/SVG
 * behind a misleading extension. The upload presigner only signs PNG/JPEG
 * content types, so an R2 URL with an allowed extension is one our own flow
 * produced.
 *
 * This module reads env, so it is server-only — keep it out of client code.
 */

import { ALLOWED_SCREENSHOT_EXTENSIONS } from "./config";
import { isUrlOnPublicBase, parseHttpUrl, urlPathExtension } from "./urls";

export function getR2PublicBaseUrl(): string | null {
  const value = process.env.R2_PUBLIC_BASE_URL?.trim();
  return value || null;
}

export type PlatformImageValidation = { ok: true } | { ok: false; error: string };

/**
 * Validate one image URL that a creator is trying to save.
 * `label` names the field in error messages ("Screenshot", "Attachment", ...).
 */
export function validatePlatformImageUrl(value: string, label: string): PlatformImageValidation {
  const url = parseHttpUrl(value);
  if (!url) {
    return { ok: false, error: `${label} must be a valid URL.` };
  }

  const ext = urlPathExtension(url);
  if (!ext || !ALLOWED_SCREENSHOT_EXTENSIONS.includes(ext)) {
    return {
      ok: false,
      error: `${label} must be a PNG or JPG image (no GIF, WebP, or SVG).`,
    };
  }

  const base = getR2PublicBaseUrl();
  if (!base) {
    // The presigner needs R2_PUBLIC_BASE_URL too, so in production a missing
    // base means no platform upload can exist: fail closed rather than let
    // any PNG/JPG URL through. Local dev setups without R2 keep the
    // extension-only check so the forms stay usable.
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        error: `${label} cannot be saved: image uploads are not configured on this server.`,
      };
    }
    return { ok: true };
  }

  if (!isUrlOnPublicBase(value, base)) {
    return {
      ok: false,
      error: `${label} must be uploaded here directly — external image links aren't accepted.`,
    };
  }

  return { ok: true };
}

export function validatePlatformImageUrls(
  values: readonly string[],
  label: string,
): PlatformImageValidation {
  for (const value of values) {
    const result = validatePlatformImageUrl(value, label);
    if (!result.ok) return result;
  }
  return { ok: true };
}

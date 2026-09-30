import { sanitizeText, TEXT_LIMITS } from "@/lib/sanitize";

export const MIN_CREATOR_ORIGINALITY_RATIONALE_LENGTH = 30;

export type CreatorOriginalityDeclaration = {
  creatorDeclaredOriginality: boolean;
  creatorDuplicateExplanation: string | null;
  creatorOriginalityRationale: string | null;
};

function normalizeOptionalText(value: string | null | undefined) {
  const cleaned = sanitizeText(value, { maxLength: TEXT_LIMITS.longText, multiline: true });
  return cleaned.length > 0 ? cleaned : null;
}

export function validateCreatorOriginalityDeclaration(value: CreatorOriginalityDeclaration):
  | { ok: true; value: CreatorOriginalityDeclaration }
  | { ok: false; error: string } {
  // Overlap details only make sense when the creator says it may overlap;
  // drop stale text left over from before they switched to "unique".
  const creatorDuplicateExplanation = value.creatorDeclaredOriginality
    ? null
    : normalizeOptionalText(value.creatorDuplicateExplanation);
  const creatorOriginalityRationale = normalizeOptionalText(value.creatorOriginalityRationale);

  return {
    ok: true,
    value: {
      creatorDeclaredOriginality: value.creatorDeclaredOriginality,
      creatorDuplicateExplanation,
      creatorOriginalityRationale,
    },
  };
}

export const MIN_CREATOR_ORIGINALITY_RATIONALE_LENGTH = 30;

export type CreatorOriginalityDeclaration = {
  creatorDeclaredOriginality: boolean;
  creatorDuplicateExplanation: string | null;
  creatorOriginalityRationale: string | null;
};

function normalizeOptionalText(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function validateCreatorOriginalityDeclaration(value: CreatorOriginalityDeclaration):
  | { ok: true; value: CreatorOriginalityDeclaration }
  | { ok: false; error: string } {
  const creatorDuplicateExplanation = normalizeOptionalText(value.creatorDuplicateExplanation);
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

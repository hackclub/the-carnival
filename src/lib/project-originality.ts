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

  if (value.creatorDeclaredOriginality) {
    if (creatorDuplicateExplanation || creatorOriginalityRationale) {
      return {
        ok: false,
        error: "Remove overlap explanation fields when declaring the project fully original.",
      };
    }
    return {
      ok: true,
      value: {
        creatorDeclaredOriginality: true,
        creatorDuplicateExplanation: null,
        creatorOriginalityRationale: null,
      },
    };
  }

  if (
    !creatorOriginalityRationale ||
    creatorOriginalityRationale.length < MIN_CREATOR_ORIGINALITY_RATIONALE_LENGTH
  ) {
    return {
      ok: false,
      error: `Please explain what makes your project different in at least ${MIN_CREATOR_ORIGINALITY_RATIONALE_LENGTH} characters.`,
    };
  }

  return {
    ok: true,
    value: {
      creatorDeclaredOriginality: false,
      creatorDuplicateExplanation,
      creatorOriginalityRationale,
    },
  };
}

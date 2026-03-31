const MAX_CATEGORY_LENGTH = 64;
const MAX_TAG_LENGTH = 32;
const MAX_TAGS = 8;

function collapseWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeCategory(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = collapseWhitespace(value).toLowerCase();
  if (!normalized) return null;
  return normalized.slice(0, MAX_CATEGORY_LENGTH);
}

export function normalizeTag(value: unknown) {
  if (typeof value !== "string") return null;
  const withoutHash = collapseWhitespace(value).replace(/^#/, "").trim();
  if (!withoutHash) return null;

  const slug = withoutHash
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!slug) return null;
  return slug.slice(0, MAX_TAG_LENGTH);
}

export function normalizeProjectTags(input: unknown) {
  const rawValues = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(",")
      : [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of rawValues) {
    const tag = normalizeTag(raw);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    normalized.push(tag);
    if (normalized.length >= MAX_TAGS) break;
  }

  return normalized;
}

export function buildCategorySuggestions(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const categories: string[] = [];
  for (const value of values) {
    const category = normalizeCategory(value);
    if (!category || seen.has(category)) continue;
    seen.add(category);
    categories.push(category);
  }
  return categories.sort((a, b) => a.localeCompare(b));
}

export function buildTagSuggestions(values: Array<string[] | null | undefined>) {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const list of values) {
    const normalized = normalizeProjectTags(list ?? []);
    for (const tag of normalized) {
      if (seen.has(tag)) continue;
      seen.add(tag);
      tags.push(tag);
    }
  }
  return tags.sort((a, b) => a.localeCompare(b));
}

export function formatCategoryLabel(value: string | null | undefined) {
  const category = normalizeCategory(value);
  if (!category) return null;
  return category.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatTagLabel(value: string | null | undefined) {
  const tag = normalizeTag(value);
  if (!tag) return null;
  return tag.replace(/-/g, " ");
}

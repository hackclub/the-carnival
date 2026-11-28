/**
 * The creator's mailing address as Hack Club Identity reports it.
 *
 * One parser for every place that reads it — sign-in (which stores it on the
 * user row), the grant page (which shows it to the admin) and the Airtable
 * grant payload — so the three can never disagree about which keys hold the
 * street lines. Pure: no db or env access.
 */

export type IdentityAddress = {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateProvince: string | null;
  country: string | null;
  zipPostalCode: string | null;
};

export type IdentityAddressField = keyof IdentityAddress;

export const EMPTY_IDENTITY_ADDRESS: IdentityAddress = {
  addressLine1: null,
  addressLine2: null,
  city: null,
  stateProvince: null,
  country: null,
  zipPostalCode: null,
};

export const IDENTITY_ADDRESS_FIELD_LABELS: Record<IdentityAddressField, string> = {
  addressLine1: "Address (Line 1)",
  addressLine2: "Address (Line 2)",
  city: "City",
  stateProvince: "State / Province",
  country: "Country",
  zipPostalCode: "ZIP / Postal Code",
};

/**
 * Fields a parcel cannot be addressed without. Line 2 and state are optional,
 * and so is the postal code: plenty of countries do not use one.
 */
const REQUIRED_ADDRESS_FIELDS: IdentityAddressField[] = ["addressLine1", "city", "country"];

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Where the address lives inside an identity object: `address`, else the
 * primary entry of `addresses` (first entry when none is marked primary),
 * else flat on the identity itself.
 */
function getAddressSource(identity: Record<string, unknown>): Record<string, unknown> {
  if (isRecord(identity.address)) return identity.address;

  if (Array.isArray(identity.addresses)) {
    const entries = identity.addresses.filter(isRecord);
    const chosen = entries.find((a) => a.primary === true) ?? entries[0];
    if (chosen) return chosen;
  }

  return identity;
}

/** Parse the address out of an identity object (the `identity` of `/api/v1/me`). */
export function parseIdentityAddress(identity: unknown): IdentityAddress {
  if (!isRecord(identity)) return { ...EMPTY_IDENTITY_ADDRESS };
  const a = getAddressSource(identity);

  return {
    addressLine1: toNullableString(
      a.line_1 ?? a.address_line_1 ?? a.addressLine1 ?? a.line1 ?? a.street_1,
    ),
    addressLine2: toNullableString(
      a.line_2 ?? a.address_line_2 ?? a.addressLine2 ?? a.line2 ?? a.street_2,
    ),
    city: toNullableString(a.city ?? a.locality ?? a.town),
    stateProvince: toNullableString(a.state ?? a.state_province ?? a.stateProvince ?? a.region),
    country: toNullableString(a.country ?? a.country_code ?? a.countryCode),
    zipPostalCode: toNullableString(
      a.postal_code ?? a.zip_postal_code ?? a.zipPostalCode ?? a.postcode,
    ),
  };
}

const ADDRESS_FIELDS = Object.keys(EMPTY_IDENTITY_ADDRESS) as IdentityAddressField[];

/** Copy only the six address fields (callers may pass a wider profile object). */
function onlyAddressFields(source: IdentityAddress): IdentityAddress {
  const out: IdentityAddress = { ...EMPTY_IDENTITY_ADDRESS };
  for (const field of ADDRESS_FIELDS) out[field] = toNullableString(source[field]);
  return out;
}

export function hasAnyAddressField(address: IdentityAddress): boolean {
  return ADDRESS_FIELDS.some((field) => !!toNullableString(address[field]));
}

export function missingRequiredAddressFields(address: IdentityAddress): IdentityAddressField[] {
  return REQUIRED_ADDRESS_FIELDS.filter((field) => !address[field]?.trim());
}

/**
 * Why a grant is refused over the address, or null when it may proceed. One
 * wording for the API error and the grant page.
 */
export function getAddressGrantBlock(missingRequired: IdentityAddressField[]): string | null {
  if (missingRequired.length === 0) return null;
  const missing = missingRequired.map((field) => IDENTITY_ADDRESS_FIELD_LABELS[field]).join(", ");
  return `The creator's address is incomplete (missing ${missing}), so this project cannot be granted yet. Ask them to complete their address in Hack Club Identity and sign in to Carnival again.`;
}

/**
 * - "identity": fetched live from Hack Club Identity just now.
 * - "stored": the copy saved on the user row at their last sign-in (no token,
 *   the live fetch failed, or Identity returned no address).
 * - "none": no address anywhere.
 */
export type CreatorAddressSource = "identity" | "stored" | "none";

export type ResolvedCreatorAddress = {
  address: IdentityAddress;
  source: CreatorAddressSource;
  missingRequired: IdentityAddressField[];
};

/**
 * Pick the address to show and send. Whole addresses only: the live one wins
 * when it has anything at all, otherwise the stored one. Never field-by-field,
 * which could splice a stale stored line 2 into a fresh live address.
 */
export function resolveCreatorAddress(input: {
  live: IdentityAddress | null;
  stored: IdentityAddress | null;
}): ResolvedCreatorAddress {
  const pick = (raw: IdentityAddress, source: CreatorAddressSource) => {
    const address = onlyAddressFields(raw);
    return { address, source, missingRequired: missingRequiredAddressFields(address) };
  };

  if (input.live && hasAnyAddressField(input.live)) return pick(input.live, "identity");
  if (input.stored && hasAnyAddressField(input.stored)) return pick(input.stored, "stored");
  return pick({ ...EMPTY_IDENTITY_ADDRESS }, "none");
}

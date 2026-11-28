import { describe, expect, test } from "bun:test";

const {
  getAddressGrantBlock,
  isSameAddress,
  parseReviewedAddress,
  parseIdentityAddress,
  resolveCreatorAddress,
  missingRequiredAddressFields,
} = await import("./identity-address.ts");

const EMPTY = {
  addressLine1: null,
  addressLine2: null,
  city: null,
  stateProvince: null,
  country: null,
  zipPostalCode: null,
};

describe("parseIdentityAddress", () => {
  test("reads the Hack Club Identity addresses[] shape, street lines included", () => {
    const parsed = parseIdentityAddress({
      id: "ident!abc",
      addresses: [
        {
          line_1: "15 Falls Rd",
          line_2: "Suite 2",
          city: "Shelburne",
          state: "VT",
          postal_code: "05482",
          country: "US",
          primary: true,
        },
      ],
    });
    expect(parsed).toEqual({
      addressLine1: "15 Falls Rd",
      addressLine2: "Suite 2",
      city: "Shelburne",
      stateProvince: "VT",
      country: "US",
      zipPostalCode: "05482",
    });
  });

  test("prefers the primary address over the first one", () => {
    const parsed = parseIdentityAddress({
      addresses: [
        { line_1: "Old Place", city: "Oldtown", primary: false },
        { line_1: "New Place", city: "Newtown", primary: true },
      ],
    });
    expect(parsed.addressLine1).toBe("New Place");
    expect(parsed.city).toBe("Newtown");
  });

  test("falls back to the first address when none is primary", () => {
    const parsed = parseIdentityAddress({
      addresses: [{ line_1: "First" }, { line_1: "Second" }],
    });
    expect(parsed.addressLine1).toBe("First");
  });

  test("reads a single address object and blanks become null", () => {
    const parsed = parseIdentityAddress({
      address: { address_line_1: " 1 Main St ", address_line_2: "  ", postcode: "AB1 2CD" },
    });
    expect(parsed.addressLine1).toBe("1 Main St");
    expect(parsed.addressLine2).toBeNull();
    expect(parsed.zipPostalCode).toBe("AB1 2CD");
  });

  test("non-object input yields an empty address", () => {
    expect(parseIdentityAddress(null)).toEqual(EMPTY);
    expect(parseIdentityAddress("nope")).toEqual(EMPTY);
  });
});

describe("resolveCreatorAddress", () => {
  const stored = {
    ...EMPTY,
    addressLine1: "Stored St",
    addressLine2: "Apt 9",
    city: "Storedville",
  };

  test("takes the live address whole — no stored line 2 spliced in", () => {
    const live = {
      ...EMPTY,
      addressLine1: "Live Ave",
      city: "Livetown",
      country: "US",
      zipPostalCode: "10001",
    };
    const resolved = resolveCreatorAddress({ live, stored });
    expect(resolved.source).toBe("identity");
    expect(resolved.address.addressLine2).toBeNull();
    expect(resolved.address.addressLine1).toBe("Live Ave");
    expect(resolved.missingRequired).toEqual([]);
  });

  test("falls back to the stored address when Identity could not be reached", () => {
    const resolved = resolveCreatorAddress({ live: null, stored });
    expect(resolved.source).toBe("stored");
    expect(resolved.address.addressLine2).toBe("Apt 9");
    expect(resolved.missingRequired).toEqual(["country"]);
  });

  test("a live profile with a name but no address does not count as an address", () => {
    const live = { ...EMPTY, name: "Orpheus", email: "o@example.com" };
    const resolved = resolveCreatorAddress({ live, stored });
    expect(resolved.source).toBe("stored");
    expect(resolved.address).not.toHaveProperty("name");
  });

  test("reports none when there is no address anywhere", () => {
    const resolved = resolveCreatorAddress({ live: null, stored: EMPTY });
    expect(resolved.source).toBe("none");
    expect(resolved.address).toEqual(EMPTY);
  });
});

test("line 2, state and postal code are not required", () => {
  expect(
    missingRequiredAddressFields({
      ...EMPTY,
      addressLine1: "1 Main St",
      city: "Town",
      country: "CM",
    }),
  ).toEqual([]);
  expect(missingRequiredAddressFields(EMPTY)).toEqual(["addressLine1", "city", "country"]);
});

test("grant block names the missing fields, and is null for a complete address", () => {
  expect(getAddressGrantBlock([])).toBeNull();
  const block = getAddressGrantBlock(["addressLine1", "country"]);
  expect(block).toContain("Address (Line 1), Country");
  expect(block).toContain("cannot be granted");
});

test("reviewed address round-trips and compares on the six fields only", () => {
  const shown = { ...EMPTY, addressLine1: "15 Falls Rd", city: "Shelburne", country: "US" };
  const parsed = parseReviewedAddress(JSON.parse(JSON.stringify({ ...shown, extra: "x" })));
  expect(parsed).toEqual(shown);
  expect(isSameAddress(parsed, { ...shown, addressLine2: "  " })).toBe(true);
  expect(isSameAddress(parsed, { ...shown, city: "Burlington" })).toBe(false);
  expect(parseReviewedAddress(undefined)).toBeNull();
  expect(parseReviewedAddress("15 Falls Rd")).toBeNull();
});

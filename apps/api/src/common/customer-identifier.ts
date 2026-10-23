import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

const POSTAL_CODE_PATTERN = /^[A-Z0-9]{2,12}$/;

export function normalizeCustomerEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeCustomerPhone(
  value: string | null | undefined,
  defaultCountry: CountryCode = "ES",
): string | null {
  const candidate = value?.trim();
  if (!candidate) {
    return null;
  }

  const phone = parsePhoneNumberFromString(candidate, defaultCountry);
  return phone?.isValid() ? phone.number : null;
}

export function normalizeCustomerPostalCode(
  value: string | null | undefined,
): string | null {
  const postalCode = value?.trim().toUpperCase().replace(/[\s-]/g, "") ?? "";
  return POSTAL_CODE_PATTERN.test(postalCode) ? postalCode : null;
}

export function maskCustomerEmail(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const email = normalizeCustomerEmail(value);
  const separator = email.lastIndexOf("@");
  if (separator <= 0 || separator === email.length - 1) {
    return null;
  }

  const local = email.slice(0, separator);
  const domain = email.slice(separator + 1);
  const visibleLocal =
    local.length <= 2
      ? `${local[0]}***${local.slice(-1)}`
      : local.length <= 4
        ? `${local[0]}***${local.slice(-1)}`
        : `${local.slice(0, 2)}***${local.slice(-2)}`;

  return `${visibleLocal}@${domain}`;
}

export function maskCustomerPhone(
  value: string | null | undefined,
  defaultCountry: CountryCode = "ES",
): string | null {
  const normalized = normalizeCustomerPhone(value, defaultCountry);
  if (!normalized) {
    return null;
  }

  const phone = parsePhoneNumberFromString(normalized);
  if (!phone) {
    return null;
  }

  const nationalNumber = phone.nationalNumber;
  const visibleDigits = nationalNumber.slice(-4);
  const hiddenDigits = "*".repeat(
    Math.max(2, nationalNumber.length - visibleDigits.length),
  );

  return `+${phone.countryCallingCode}${hiddenDigits}${visibleDigits}`;
}

export function formatCustomerDisplayId(
  value: string,
  prefix = "CLI",
): string | null {
  const compactId = value.trim().replace(/[^a-zA-Z0-9]/g, "");
  if (!compactId) {
    return null;
  }

  return `${prefix}-${compactId.slice(-8).toUpperCase()}`;
}

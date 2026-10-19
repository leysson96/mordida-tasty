export const cookieConsentStorageKey = "mordida_cookie_consent";
export const cookieConsentChangedEvent = "mordida_cookie_consent_changed";

export type CookieConsent = "technical" | "analytics";
export type GoogleConsentValue = "denied" | "granted";

export interface CookieConsentPreference {
  version: 2;
  analytics: boolean;
  advertising: boolean;
  personalization: boolean;
}

export interface GoogleConsentState {
  analytics_storage: GoogleConsentValue;
  ad_storage: GoogleConsentValue;
  ad_user_data: GoogleConsentValue;
  ad_personalization: GoogleConsentValue;
}

export const deniedGoogleConsentState: GoogleConsentState = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
};

export function isCookieConsent(value: string | null) {
  return parseCookieConsent(value) !== null;
}

export function hasAnalyticsConsent(value: string | null) {
  return parseCookieConsent(value)?.analytics ?? false;
}

export function parseCookieConsent(
  value: string | null,
): CookieConsentPreference | null {
  if (value === "technical") {
    return createCookieConsentPreference(false, false, false);
  }

  if (value === "analytics") {
    return createCookieConsentPreference(true, false, false);
  }

  if (!value) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isCookieConsentPreference(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function serializeCookieConsent(preference: CookieConsentPreference) {
  if (!isCookieConsentPreference(preference)) {
    throw new TypeError("Invalid cookie consent preference.");
  }
  return JSON.stringify(preference);
}

export function createCookieConsentPreference(
  analytics: boolean,
  advertising: boolean,
  personalization: boolean,
): CookieConsentPreference {
  if (personalization && !advertising) {
    throw new TypeError(
      "Advertising consent is required for ad personalization.",
    );
  }

  return {
    version: 2,
    analytics,
    advertising,
    personalization,
  };
}

export function cookieConsentToGoogleState(
  preference: CookieConsentPreference | null,
): GoogleConsentState {
  if (!preference) {
    return { ...deniedGoogleConsentState };
  }

  return {
    analytics_storage: preference.analytics ? "granted" : "denied",
    ad_storage: preference.advertising ? "granted" : "denied",
    ad_user_data: preference.advertising ? "granted" : "denied",
    ad_personalization: preference.personalization ? "granted" : "denied",
  };
}

export function storedCookieConsentToGoogleState(value: string | null) {
  return cookieConsentToGoogleState(parseCookieConsent(value));
}

function isCookieConsentPreference(
  value: unknown,
): value is CookieConsentPreference {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.version === 2 &&
    typeof value.analytics === "boolean" &&
    typeof value.advertising === "boolean" &&
    typeof value.personalization === "boolean" &&
    (!value.personalization || value.advertising)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const cookieConsentStorageKey = "mordida_cookie_consent";
export const cookieConsentChangedEvent = "mordida_cookie_consent_changed";

export type CookieConsent = "technical" | "analytics";

export function isCookieConsent(value: string | null): value is CookieConsent {
  return value === "technical" || value === "analytics";
}

export function hasAnalyticsConsent(value: string | null) {
  return value === "analytics";
}

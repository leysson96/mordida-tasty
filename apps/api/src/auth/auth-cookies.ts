import { CookieOptions, Response } from "express";
import {
  CUSTOMER_ABSOLUTE_SESSION_MS,
  STAFF_ABSOLUTE_SESSION_MS,
} from "./session-policy";

export const CLIENT_SESSION_COOKIE = "mordida_session";
export const CLIENT_REFRESH_COOKIE = "mordida_refresh";
export const ADMIN_SESSION_COOKIE = "mordida_admin_session";
export const ADMIN_REFRESH_COOKIE = "mordida_admin_refresh";
export const ADMIN_ENROLLMENT_COOKIE = "mordida_admin_2fa_enrollment";

export const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
export const CLIENT_REFRESH_MAX_AGE_MS = CUSTOMER_ABSOLUTE_SESSION_MS;
export const ADMIN_SESSION_MAX_AGE_MS = ACCESS_TOKEN_MAX_AGE_MS;
export const ADMIN_REFRESH_MAX_AGE_MS = STAFF_ABSOLUTE_SESSION_MS;
export const ENROLLMENT_MAX_AGE_MS = 10 * 60 * 1000;

export interface SessionCookieConfig {
  production: boolean;
  domain?: string;
  sameSite?: CookieOptions["sameSite"];
}

export function sessionCookieOptions(
  configOrProduction: boolean | SessionCookieConfig,
  maxAgeMs = ACCESS_TOKEN_MAX_AGE_MS,
): CookieOptions {
  const config =
    typeof configOrProduction === "boolean"
      ? { production: configOrProduction }
      : configOrProduction;

  return {
    httpOnly: true,
    secure: config.production,
    sameSite: config.sameSite ?? "lax",
    path: "/",
    maxAge: maxAgeMs,
    ...(config.domain ? { domain: config.domain } : {}),
  };
}

export function setSessionCookie(
  response: Response,
  cookieName: string,
  token: string,
  configOrProduction: boolean | SessionCookieConfig,
  maxAgeMs?: number,
) {
  response.cookie(
    cookieName,
    token,
    sessionCookieOptions(configOrProduction, maxAgeMs),
  );
}

export function clearSessionCookie(
  response: Response,
  cookieName: string,
  configOrProduction: boolean | SessionCookieConfig,
) {
  response.clearCookie(cookieName, {
    ...sessionCookieOptions(configOrProduction),
    maxAge: undefined,
  });
}

export function setCustomerSessionCookies(
  response: Response,
  tokens: { accessToken: string; refreshToken: string },
  config: SessionCookieConfig,
) {
  setSessionCookie(response, CLIENT_SESSION_COOKIE, tokens.accessToken, config);
  setSessionCookie(
    response,
    CLIENT_REFRESH_COOKIE,
    tokens.refreshToken,
    config,
    CLIENT_REFRESH_MAX_AGE_MS,
  );
}

export function setAdminSessionCookies(
  response: Response,
  tokens: { accessToken: string; refreshToken: string },
  config: SessionCookieConfig,
) {
  setSessionCookie(response, ADMIN_SESSION_COOKIE, tokens.accessToken, config);
  setSessionCookie(
    response,
    ADMIN_REFRESH_COOKIE,
    tokens.refreshToken,
    config,
    ADMIN_REFRESH_MAX_AGE_MS,
  );
}

export function clearCustomerSessionCookies(
  response: Response,
  config: SessionCookieConfig,
) {
  clearSessionCookie(response, CLIENT_SESSION_COOKIE, config);
  clearSessionCookie(response, CLIENT_REFRESH_COOKIE, config);
}

export function clearAdminSessionCookies(
  response: Response,
  config: SessionCookieConfig,
) {
  clearSessionCookie(response, ADMIN_SESSION_COOKIE, config);
  clearSessionCookie(response, ADMIN_REFRESH_COOKIE, config);
  clearSessionCookie(response, ADMIN_ENROLLMENT_COOKIE, config);
}

export function setEnrollmentCookie(
  response: Response,
  token: string,
  config: SessionCookieConfig,
) {
  setSessionCookie(
    response,
    ADMIN_ENROLLMENT_COOKIE,
    token,
    config,
    ENROLLMENT_MAX_AGE_MS,
  );
}

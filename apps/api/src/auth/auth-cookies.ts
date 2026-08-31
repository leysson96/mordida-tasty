import { CookieOptions, Response } from 'express';

export const CLIENT_SESSION_COOKIE = 'mordida_session';
export const ADMIN_SESSION_COOKIE = 'mordida_admin_session';

const clientSessionMaxAgeMs = 7 * 24 * 60 * 60 * 1000;
export const ADMIN_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface SessionCookieConfig {
  production: boolean;
  domain?: string;
  sameSite?: CookieOptions['sameSite'];
}

export function sessionCookieOptions(
  configOrProduction: boolean | SessionCookieConfig,
  maxAgeMs = clientSessionMaxAgeMs
): CookieOptions {
  const config =
    typeof configOrProduction === 'boolean'
      ? { production: configOrProduction }
      : configOrProduction;

  return {
    httpOnly: true,
    secure: config.production,
    sameSite: config.sameSite ?? 'lax',
    path: '/',
    maxAge: maxAgeMs,
    ...(config.domain ? { domain: config.domain } : {})
  };
}

export function setSessionCookie(
  response: Response,
  cookieName: string,
  token: string,
  configOrProduction: boolean | SessionCookieConfig,
  maxAgeMs?: number
) {
  response.cookie(cookieName, token, sessionCookieOptions(configOrProduction, maxAgeMs));
}

export function clearSessionCookie(
  response: Response,
  cookieName: string,
  configOrProduction: boolean | SessionCookieConfig
) {
  response.clearCookie(cookieName, {
    ...sessionCookieOptions(configOrProduction),
    maxAge: undefined
  });
}

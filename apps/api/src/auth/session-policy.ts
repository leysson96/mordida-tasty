import { AuthSessionScope, Role } from "@prisma/client";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const CUSTOMER_IDLE_SESSION_MS = 30 * DAY_MS;
export const CUSTOMER_ABSOLUTE_SESSION_MS = 90 * DAY_MS;
export const STAFF_ABSOLUTE_SESSION_MS = 12 * HOUR_MS;

export interface SessionWindow {
  scope: AuthSessionScope;
  expiresAt: Date;
  absoluteExpiresAt: Date;
}

export function sessionWindowForRole(
  role: Role,
  now = new Date(),
): SessionWindow {
  if (role === Role.CLIENTE) {
    return {
      scope: AuthSessionScope.CUSTOMER,
      expiresAt: addMilliseconds(now, CUSTOMER_IDLE_SESSION_MS),
      absoluteExpiresAt: addMilliseconds(
        now,
        CUSTOMER_ABSOLUTE_SESSION_MS,
      ),
    };
  }

  const absoluteExpiresAt = addMilliseconds(now, STAFF_ABSOLUTE_SESSION_MS);
  return {
    scope: AuthSessionScope.STAFF,
    expiresAt: absoluteExpiresAt,
    absoluteExpiresAt,
  };
}

export function renewedSessionExpiration(input: {
  scope: AuthSessionScope;
  now?: Date;
  absoluteExpiresAt: Date;
}) {
  const now = input.now ?? new Date();
  const requestedExpiration =
    input.scope === AuthSessionScope.CUSTOMER
      ? addMilliseconds(now, CUSTOMER_IDLE_SESSION_MS)
      : input.absoluteExpiresAt;

  return new Date(
    Math.min(requestedExpiration.getTime(), input.absoluteExpiresAt.getTime()),
  );
}

function addMilliseconds(value: Date, milliseconds: number) {
  return new Date(value.getTime() + milliseconds);
}

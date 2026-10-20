import { AuthSessionScope, Role } from "@prisma/client";
import {
  CUSTOMER_ABSOLUTE_SESSION_MS,
  CUSTOMER_IDLE_SESSION_MS,
  renewedSessionExpiration,
  sessionWindowForRole,
  STAFF_ABSOLUTE_SESSION_MS,
} from "./session-policy";

describe("session policy", () => {
  const now = new Date("2026-10-20T10:00:00.000Z");

  it("gives customers 30 idle days and a 90 day absolute limit", () => {
    const window = sessionWindowForRole(Role.CLIENTE, now);

    expect(window).toEqual({
      scope: AuthSessionScope.CUSTOMER,
      expiresAt: new Date(now.getTime() + CUSTOMER_IDLE_SESSION_MS),
      absoluteExpiresAt: new Date(
        now.getTime() + CUSTOMER_ABSOLUTE_SESSION_MS,
      ),
    });
  });

  it.each([Role.ADMIN, Role.KITCHEN])(
    "gives %s a non-renewable 12 hour shift session",
    (role) => {
      const window = sessionWindowForRole(role, now);
      const expected = new Date(now.getTime() + STAFF_ABSOLUTE_SESSION_MS);

      expect(window).toEqual({
        scope: AuthSessionScope.STAFF,
        expiresAt: expected,
        absoluteExpiresAt: expected,
      });
    },
  );

  it("never renews a customer beyond the absolute limit", () => {
    const absoluteExpiresAt = new Date("2026-11-01T10:00:00.000Z");

    expect(
      renewedSessionExpiration({
        scope: AuthSessionScope.CUSTOMER,
        now,
        absoluteExpiresAt,
      }),
    ).toEqual(absoluteExpiresAt);
  });

  it("does not extend staff sessions", () => {
    const absoluteExpiresAt = new Date(
      now.getTime() + STAFF_ABSOLUTE_SESSION_MS,
    );

    expect(
      renewedSessionExpiration({
        scope: AuthSessionScope.STAFF,
        now: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        absoluteExpiresAt,
      }),
    ).toEqual(absoluteExpiresAt);
  });
});

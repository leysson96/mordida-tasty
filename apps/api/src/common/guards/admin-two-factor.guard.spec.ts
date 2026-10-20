import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Role } from "@prisma/client";
import {
  AdminTwoFactorGuard,
  TwoFactorEnrollmentGuard,
} from "./admin-two-factor.guard";

function context(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
}

describe("staff two-factor guards", () => {
  const prisma = { user: { findUnique: jest.fn() } };
  const jwt = { verifyAsync: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it.each([Role.ADMIN, Role.KITCHEN])(
    "blocks %s sessions until 2FA is enabled",
    async (role) => {
      prisma.user.findUnique.mockResolvedValue({ twoFactorEnabled: false });
      const guard = new AdminTwoFactorGuard(prisma as never);
      await expect(
        guard.canActivate(
          context({ user: { id: "staff-1", role } }),
        ),
      ).rejects.toThrow(ForbiddenException);
    },
  );

  it("accepts a limited enrollment cookie for active staff without 2FA", async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: "staff-1",
      email: "staff@mordida.test",
      role: Role.KITCHEN,
      purpose: "2fa-enrollment",
    });
    prisma.user.findUnique.mockResolvedValue({
      id: "staff-1",
      email: "staff@mordida.test",
      role: Role.KITCHEN,
      active: true,
      twoFactorEnabled: false,
    });
    const request: Record<string, unknown> = {
      cookies: { mordida_admin_2fa_enrollment: "enrollment-token" },
    };

    await expect(
      new TwoFactorEnrollmentGuard(jwt as never, prisma as never).canActivate(
        context(request),
      ),
    ).resolves.toBe(true);
    expect(request.user).toEqual(
      expect.objectContaining({
        id: "staff-1",
        authPurpose: "2fa-enrollment",
      }),
    );
  });

  it("rejects an enrollment token on a user that already has 2FA", async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: "staff-1",
      email: "staff@mordida.test",
      role: Role.ADMIN,
      purpose: "2fa-enrollment",
    });
    prisma.user.findUnique.mockResolvedValue({
      id: "staff-1",
      email: "staff@mordida.test",
      role: Role.ADMIN,
      active: true,
      twoFactorEnabled: true,
    });

    await expect(
      new TwoFactorEnrollmentGuard(jwt as never, prisma as never).canActivate(
        context({
          cookies: { mordida_admin_2fa_enrollment: "enrollment-token" },
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});

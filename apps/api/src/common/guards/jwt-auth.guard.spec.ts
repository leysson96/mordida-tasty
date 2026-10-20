import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { AuthSessionScope, Role } from "@prisma/client";
import { JwtAuthGuard, OptionalJwtAuthGuard } from "./jwt-auth.guard";

describe("JWT session guards", () => {
  const request: Record<string, unknown> = {
    headers: { authorization: "Bearer signed-token" },
    path: "/customers/me",
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
  const jwtService = {
    verifyAsync: jest.fn(),
  };
  const prisma = {
    authSession: { findUnique: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete request.user;
    jwtService.verifyAsync.mockResolvedValue({
      sub: "user-1",
      email: "cliente@mordida.test",
      role: Role.CLIENTE,
      sid: "session-1",
    });
    prisma.authSession.findUnique.mockResolvedValue({
      id: "session-1",
      userId: "user-1",
      scope: AuthSessionScope.CUSTOMER,
      expiresAt: new Date(Date.now() + 60_000),
      absoluteExpiresAt: new Date(Date.now() + 120_000),
      revokedAt: null,
      user: {
        id: "user-1",
        email: "cliente@mordida.test",
        role: Role.CLIENTE,
        active: true,
      },
    });
  });

  it("accepts a signed token backed by an active server session", async () => {
    await expect(
      new JwtAuthGuard(jwtService as never, prisma as never).canActivate(context),
    ).resolves.toBe(true);

    expect(prisma.authSession.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "session-1" },
      }),
    );
    expect(request.user).toEqual(
      expect.objectContaining({ sessionId: "session-1", id: "user-1" }),
    );
  });

  it.each<
    [
      string,
      {
        revokedAt?: Date;
        expiresAt?: Date;
        absoluteExpiresAt?: Date;
        user?: { active: boolean };
      },
    ]
  >([
    ["revoked", { revokedAt: new Date() }],
    ["expired", { expiresAt: new Date(Date.now() - 1_000) }],
    ["absolute expiry", { absoluteExpiresAt: new Date(Date.now() - 1_000) }],
    ["disabled user", { user: { active: false } }],
  ])("rejects a %s session", async (_label, override) => {
    const active = await prisma.authSession.findUnique();
    prisma.authSession.findUnique.mockResolvedValue({
      ...active,
      ...override,
      user: { ...active.user, ...(override.user ?? {}) },
    });

    await expect(
      new JwtAuthGuard(jwtService as never, prisma as never).canActivate(context),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("rejects legacy JWTs without a server session id", async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: "user-1",
      email: "cliente@mordida.test",
      role: Role.CLIENTE,
    });

    await expect(
      new JwtAuthGuard(jwtService as never, prisma as never).canActivate(context),
    ).rejects.toThrow(UnauthorizedException);
    expect(prisma.authSession.findUnique).not.toHaveBeenCalled();
  });

  it("treats a revoked session as anonymous on optional routes", async () => {
    prisma.authSession.findUnique.mockResolvedValue({
      id: "session-1",
      userId: "user-1",
      scope: AuthSessionScope.CUSTOMER,
      expiresAt: new Date(Date.now() + 60_000),
      absoluteExpiresAt: new Date(Date.now() + 120_000),
      revokedAt: new Date(),
      user: { active: true },
    });

    await expect(
      new OptionalJwtAuthGuard(
        jwtService as never,
        prisma as never,
      ).canActivate(context),
    ).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });
});

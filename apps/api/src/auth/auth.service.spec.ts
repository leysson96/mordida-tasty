import { UnauthorizedException } from "@nestjs/common";
import { AuthSessionScope, Role } from "@prisma/client";
import * as argon2 from "argon2";
import { createHash } from "node:crypto";
import { authenticator } from "otplib";
import { AuthService } from "./auth.service";

describe("AuthService sessions", () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    authSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    emailVerificationToken: { create: jest.fn() },
    passwordResetToken: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const jwtService = { signAsync: jest.fn() };
  const mailService = { sendVerificationEmail: jest.fn() };
  const configService = {
    get: jest.fn((key: string) =>
      key === "NODE_ENV" ? "test" : undefined,
    ),
  };
  const totpCrypto = {
    encrypt: jest.fn((value: string) => `v1.encrypted.${value}`),
    decrypt: jest.fn((value: string) => ({ secret: value, legacy: false })),
  };
  const activeClient = {
    id: "client-1",
    email: "cliente@mordida.test",
    passwordHash: "hash",
    name: "Cliente",
    phone: null,
    role: Role.CLIENTE,
    active: true,
    disabledAt: null,
    emailVerifiedAt: new Date(),
    twoFactorSecret: null,
    twoFactorEnabled: false,
    acceptedLegalAt: null,
    legalVersion: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(argon2, "verify").mockResolvedValue(true);
    prisma.user.findUnique.mockResolvedValue(activeClient);
    prisma.user.findUniqueOrThrow.mockResolvedValue(activeClient);
    prisma.user.update.mockResolvedValue(activeClient);
    prisma.emailVerificationToken.create.mockResolvedValue({});
    prisma.authSession.create.mockResolvedValue({});
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.passwordResetToken.update.mockResolvedValue({});
    prisma.$transaction.mockImplementation((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    );
    jwtService.signAsync.mockResolvedValue("signed-access-token");
    mailService.sendVerificationEmail.mockResolvedValue(undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  function service() {
    return new AuthService(
      prisma as never,
      jwtService as never,
      mailService as never,
      configService as never,
      totpCrypto as never,
    );
  }

  it("creates a short access token and stores only the refresh hash", async () => {
    const result = await service().login({
      email: activeClient.email,
      password: "Temporal123",
    });

    if (!("refreshToken" in result)) {
      throw new Error("Expected a customer refresh token.");
    }

    expect(result).toEqual({
      accessToken: "signed-access-token",
      refreshToken: expect.stringMatching(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]+$/i),
      user: expect.objectContaining({ id: activeClient.id }),
    });
    const [sessionId, refreshSecret] = result.refreshToken.split(".");
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sid: sessionId, sub: activeClient.id }),
      { expiresIn: "15m" },
    );
    expect(prisma.authSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: sessionId,
        userId: activeClient.id,
        scope: AuthSessionScope.CUSTOMER,
        tokenHash: createHash("sha256").update(refreshSecret).digest("hex"),
        lastSeenAt: expect.any(Date),
        expiresAt: expect.any(Date),
        absoluteExpiresAt: expect.any(Date),
      }),
    });
    expect(JSON.stringify(result.user)).not.toContain(refreshSecret);
    expect(JSON.stringify(result.user)).not.toContain("passwordHash");
  });

  it("rotates a valid refresh token without exposing its secret in the user", async () => {
    const sessionId = "123e4567-e89b-12d3-a456-426614174000";
    const oldSecret = "a".repeat(43);
    prisma.authSession.findUnique.mockResolvedValue({
      id: sessionId,
      tokenHash: createHash("sha256").update(oldSecret).digest("hex"),
      userId: activeClient.id,
      scope: AuthSessionScope.CUSTOMER,
      lastSeenAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      absoluteExpiresAt: new Date(Date.now() + 120_000),
      revokedAt: null,
      user: activeClient,
    });

    const result = await service().refreshSession(
      `${sessionId}.${oldSecret}`,
      AuthSessionScope.CUSTOMER,
    );

    expect(result.refreshToken).toMatch(new RegExp(`^${sessionId}\\.`));
    expect(result.refreshToken).not.toBe(`${sessionId}.${oldSecret}`);
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: sessionId,
          tokenHash: createHash("sha256").update(oldSecret).digest("hex"),
        }),
        data: expect.objectContaining({
          tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          lastSeenAt: expect.any(Date),
        }),
      }),
    );
    expect(JSON.stringify(result.user)).not.toContain(result.refreshToken);
  });

  it("revokes the session when a rotated refresh token is reused", async () => {
    const sessionId = "123e4567-e89b-12d3-a456-426614174000";
    prisma.authSession.findUnique.mockResolvedValue({
      id: sessionId,
      tokenHash: createHash("sha256").update("b".repeat(43)).digest("hex"),
      revokedAt: null,
    });

    await expect(
      service().refreshSession(
        `${sessionId}.${"a".repeat(43)}`,
        AuthSessionScope.CUSTOMER,
      ),
    ).rejects.toThrow("Invalid or reused refresh token.");
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it.each([
    ["expired", { expiresAt: new Date(Date.now() - 1) }],
    ["revoked", { revokedAt: new Date() }],
    ["disabled", { user: { ...activeClient, active: false } }],
  ])("rejects a %s refresh session", async (_label, override) => {
    const sessionId = "123e4567-e89b-12d3-a456-426614174000";
    const secret = "a".repeat(43);
    prisma.authSession.findUnique.mockResolvedValue({
      id: sessionId,
      tokenHash: createHash("sha256").update(secret).digest("hex"),
      userId: activeClient.id,
      scope: AuthSessionScope.CUSTOMER,
      expiresAt: new Date(Date.now() + 60_000),
      absoluteExpiresAt: new Date(Date.now() + 120_000),
      revokedAt: null,
      user: activeClient,
      ...override,
    });

    await expect(
      service().refreshSession(
        `${sessionId}.${secret}`,
        AuthSessionScope.CUSTOMER,
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("rejects login for disabled users", async () => {
    prisma.user.findUnique.mockResolvedValue({ ...activeClient, active: false });
    await expect(
      service().login({ email: activeClient.email, password: "Temporal123" }),
    ).rejects.toThrow(UnauthorizedException);
    expect(prisma.authSession.create).not.toHaveBeenCalled();
  });

  it.each([Role.ADMIN, Role.KITCHEN])(
    "issues only an enrollment token when %s has no 2FA",
    async (role) => {
      prisma.user.findUnique.mockResolvedValue({
        ...activeClient,
        role,
        twoFactorEnabled: false,
      });

      const result = await service().login(
        { email: activeClient.email, password: "Temporal123" },
        [Role.ADMIN, Role.KITCHEN],
      );

      expect(result).toEqual(
        expect.objectContaining({
          enrollmentToken: "signed-access-token",
          requiresTwoFactorSetup: true,
        }),
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: "2fa-enrollment", role }),
        { expiresIn: "10m" },
      );
      expect(prisma.authSession.create).not.toHaveBeenCalled();
    },
  );

  it("migrates a valid legacy staff TOTP secret before creating a session", async () => {
    const staff = {
      ...activeClient,
      id: "staff-1",
      role: Role.KITCHEN,
      twoFactorEnabled: true,
      twoFactorSecret: "LEGACYSECRET",
    };
    prisma.user.findUnique.mockResolvedValue(staff);
    totpCrypto.decrypt.mockReturnValueOnce({
      secret: "LEGACYSECRET",
      legacy: true,
    });
    jest.spyOn(authenticator, "check").mockReturnValue(true);

    const result = await service().login(
      {
        email: staff.email,
        password: "Temporal123",
        totpCode: "123456",
      },
      [Role.ADMIN, Role.KITCHEN],
    );

    expect(result).toEqual(expect.objectContaining({ accessToken: expect.any(String) }));
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "staff-1" },
      data: { twoFactorSecret: "v1.encrypted.LEGACYSECRET" },
    });
    expect(prisma.authSession.create).toHaveBeenCalled();
  });

  it("revokes every session when a password reset succeeds", async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: "reset-1",
      userId: activeClient.id,
      tokenHash: "hash",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: activeClient,
    });

    await expect(
      service().resetPassword({
        token: "reset-token",
        password: "NuevaSegura123",
      }),
    ).resolves.toEqual({ ok: true });
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: activeClient.id, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("revokes one session without invalidating other devices", async () => {
    await service().revokeSession("session-1");
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { id: "session-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("revokes every active session for a user", async () => {
    await service().revokeAllSessions(activeClient.id);
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: activeClient.id, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

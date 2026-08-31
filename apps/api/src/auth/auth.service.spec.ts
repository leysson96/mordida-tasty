import { UnauthorizedException } from "@nestjs/common";
import { Role } from "@prisma/client";
import * as argon2 from "argon2";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  };

  const jwtService = {
    signAsync: jest.fn(),
  };

  const mailService = {};

  const configService = {
    get: jest.fn((key: string) => (key === "JWT_EXPIRES_IN" ? "7d" : "12h")),
  };

  const disabledUser = {
    id: "user-1",
    email: "admin@mordida.test",
    passwordHash: "hash",
    name: "Admin",
    phone: null,
    role: Role.ADMIN,
    active: false,
    disabledAt: new Date(),
    emailVerifiedAt: new Date(),
    twoFactorSecret: null,
    twoFactorEnabled: false,
    acceptedLegalAt: null,
    legalVersion: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const activeClient = {
    ...disabledUser,
    id: "client-1",
    email: "cliente@mordida.test",
    role: Role.CLIENTE,
    active: true,
    disabledAt: null,
    emailVerifiedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(argon2, "verify").mockResolvedValue(true);
    prisma.user.findUnique.mockResolvedValue(disabledUser);
    prisma.user.findUniqueOrThrow.mockResolvedValue(disabledUser);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function service() {
    return new AuthService(
      prisma as never,
      jwtService as never,
      mailService as never,
      configService as never,
    );
  }

  it("rejects login for disabled users even with a valid password", async () => {
    await expect(
      service().login({
        email: "admin@mordida.test",
        password: "Temporal123",
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it("rejects existing sessions after the user is disabled", async () => {
    await expect(service().me("user-1")).rejects.toThrow(UnauthorizedException);
  });

  it("rejects unverified client login before creating a session", async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...activeClient,
      emailVerifiedAt: null,
    });

    await expect(
      service().login({
        email: "cliente@mordida.test",
        password: "Temporal123",
      }),
    ).rejects.toThrow("Email address is not verified.");

    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it("allows verified client login", async () => {
    prisma.user.findUnique.mockResolvedValue(activeClient);
    jwtService.signAsync.mockResolvedValue("signed-token");

    await expect(
      service().login({
        email: "cliente@mordida.test",
        password: "Temporal123",
      }),
    ).resolves.toEqual({
      accessToken: "signed-token",
      user: expect.objectContaining({
        id: "client-1",
        email: "cliente@mordida.test",
      }),
    });
  });
});

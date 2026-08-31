import { BadRequestException, ConflictException } from "@nestjs/common";
import { Role } from "@prisma/client";
import { StaffService } from "./staff.service";

describe("StaffService", () => {
  const prisma = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  const authService = {
    requestPasswordReset: jest.fn(),
  };

  const staffUser = {
    id: "staff-1",
    email: "cocina@mordida.test",
    name: "Cocina",
    phone: null,
    role: Role.KITCHEN,
    active: true,
    disabledAt: null,
    emailVerifiedAt: new Date(),
    twoFactorEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(staffUser);
    prisma.user.create.mockResolvedValue(staffUser);
    prisma.user.update.mockResolvedValue(staffUser);
    prisma.user.count.mockResolvedValue(1);
    authService.requestPasswordReset.mockResolvedValue({ ok: true });
  });

  function service() {
    return new StaffService(prisma as never, authService as never);
  }

  it("lists only internal users by default", async () => {
    await service().listStaff();

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: { in: [Role.ADMIN, Role.KITCHEN] } },
      }),
    );
  });

  it("rejects cliente role in the staff module", async () => {
    expect(() => service().listStaff(Role.CLIENTE)).toThrow(
      BadRequestException,
    );
  });

  it("creates active verified staff with a hashed temporary password", async () => {
    await service().createStaff({
      email: " COCINA@MORDIDA.TEST ",
      name: " Cocina ",
      phone: undefined,
      role: Role.KITCHEN,
      password: "Temporal123",
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "cocina@mordida.test",
          name: "Cocina",
          role: Role.KITCHEN,
          active: true,
          disabledAt: null,
          emailVerifiedAt: expect.any(Date),
          passwordHash: expect.not.stringMatching("Temporal123"),
        }),
      }),
    );
  });

  it("rejects creating staff with an email that already exists", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "existing-user" });

    await expect(
      service().createStaff({
        email: "admin@mordida.test",
        name: "Admin",
        role: Role.ADMIN,
        password: "Temporal123",
      }),
    ).rejects.toThrow(ConflictException);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("blocks deactivating the current session user", async () => {
    prisma.user.findFirst.mockResolvedValue({
      ...staffUser,
      id: "admin-1",
      role: Role.ADMIN,
    });

    await expect(
      service().setStaffActive({
        actorId: "admin-1",
        staffId: "admin-1",
        active: false,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("blocks deactivating the last active admin", async () => {
    prisma.user.findFirst.mockResolvedValue({
      ...staffUser,
      id: "admin-1",
      role: Role.ADMIN,
      active: true,
    });
    prisma.user.count.mockResolvedValue(0);

    await expect(
      service().setStaffActive({
        actorId: "admin-2",
        staffId: "admin-1",
        active: false,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("blocks changing the last active admin into kitchen", async () => {
    prisma.user.findFirst.mockResolvedValue({
      ...staffUser,
      id: "admin-1",
      role: Role.ADMIN,
      active: true,
    });
    prisma.user.count.mockResolvedValue(0);

    await expect(
      service().updateStaff("admin-1", { role: Role.KITCHEN }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("resets staff 2FA without changing password or role", async () => {
    await service().resetTwoFactor("staff-1");

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "staff-1" },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      }),
    );
  });

  it("sends password reset only to active staff users", async () => {
    await expect(service().requestPasswordReset("staff-1")).resolves.toEqual({
      ok: true,
    });

    expect(authService.requestPasswordReset).toHaveBeenCalledWith({
      email: "cocina@mordida.test",
    });
  });
});

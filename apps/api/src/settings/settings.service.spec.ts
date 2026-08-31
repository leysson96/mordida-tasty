import { BadRequestException } from "@nestjs/common";
import { SettingsService } from "./settings.service";

describe("SettingsService", () => {
  const prisma = {
    setting: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    specialClosure: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const config = {
    get: jest.fn((key: string) =>
      key === "APP_TIMEZONE" ? "Europe/Madrid" : undefined,
    ),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.setting.findUnique.mockResolvedValue(null);
    prisma.setting.upsert.mockResolvedValue({ key: "opening_hours" });
    prisma.specialClosure.findFirst.mockResolvedValue(null);
    prisma.specialClosure.findMany.mockResolvedValue([]);
    prisma.specialClosure.create.mockResolvedValue({});
    prisma.specialClosure.findUnique.mockResolvedValue(null);
    prisma.specialClosure.update.mockResolvedValue({});
    prisma.$transaction.mockImplementation((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    );
  });

  function service() {
    return new SettingsService(prisma as never, config as never);
  }

  it("rejects invalid timezones and time values before saving", async () => {
    await expect(
      service().setOpeningHours({
        timezone: "Mars/Olympus",
        weekly: {
          monday: [],
        },
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service().setOpeningHours({
        timezone: "Europe/Madrid",
        weekly: {
          monday: [{ open: "25:00", close: "26:00" }],
        },
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.setting.upsert).not.toHaveBeenCalled();
  });

  it("stores the manual orders pause as editable settings", async () => {
    await expect(
      service().setOrdersPause({
        paused: true,
        reason: "Descanso del equipo",
      }),
    ).resolves.toEqual({
      paused: true,
      reason: "Descanso del equipo",
    });

    expect(prisma.setting.upsert).toHaveBeenCalledWith({
      where: { key: "orders_paused" },
      update: { value: true },
      create: { key: "orders_paused", value: true },
    });
    expect(prisma.setting.upsert).toHaveBeenCalledWith({
      where: { key: "orders_pause_reason" },
      update: { value: "Descanso del equipo" },
      create: { key: "orders_pause_reason", value: "Descanso del equipo" },
    });
  });

  it("normalizes valid opening hours and closes missing weekdays", async () => {
    await service().setOpeningHours({
      timezone: "Europe/Madrid",
      weekly: {
        monday: [{ open: "12:00", close: "23:00" }],
      },
    });

    expect(prisma.setting.upsert).toHaveBeenCalledWith({
      where: { key: "opening_hours" },
      update: {
        value: {
          timezone: "Europe/Madrid",
          weekly: expect.objectContaining({
            monday: [{ open: "12:00", close: "23:00" }],
            sunday: [],
          }),
        },
      },
      create: {
        key: "opening_hours",
        value: {
          timezone: "Europe/Madrid",
          weekly: expect.objectContaining({
            monday: [{ open: "12:00", close: "23:00" }],
            sunday: [],
          }),
        },
      },
    });
  });

  it("normalizes social contact settings before saving site content", async () => {
    await expect(
      service().setSiteContent({
        instagramUrl: "@mordidatasty",
        whatsappPhone: "+34 600 111 222",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        instagramUrl: "https://www.instagram.com/mordidatasty",
        whatsappPhone: "+34600111222",
      }),
    );

    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "site_content" },
        update: {
          value: expect.objectContaining({
            instagramUrl: "https://www.instagram.com/mordidatasty",
            whatsappPhone: "+34600111222",
          }),
        },
      }),
    );
  });

  it("rejects unsafe or incomplete social contact settings", async () => {
    await expect(
      service().setSiteContent({
        instagramUrl: "javascript:alert(1)",
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service().setSiteContent({
        whatsappPhone: "611752804",
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.setting.upsert).not.toHaveBeenCalled();
  });

  it("keeps overnight ranges open after midnight through the previous business day", async () => {
    prisma.setting.findUnique.mockImplementation(({ where: { key } }) =>
      Promise.resolve(
        key === "opening_hours"
          ? {
              key: "opening_hours",
              value: {
                timezone: "Europe/Madrid",
                weekly: {
                  friday: [{ open: "20:00", close: "02:00" }],
                },
              },
            }
          : null,
      ),
    );

    await expect(
      service().isOpenNow(new Date("2026-08-28T21:30:00.000Z")),
    ).resolves.toBe(true);
    await expect(
      service().isOpenNow(new Date("2026-08-28T23:30:00.000Z")),
    ).resolves.toBe(true);
    await expect(
      service().isOpenNow(new Date("2026-08-29T01:30:00.000Z")),
    ).resolves.toBe(false);
  });

  it("does not open before an overnight range starts on the same day", async () => {
    prisma.setting.findUnique.mockImplementation(({ where: { key } }) =>
      Promise.resolve(
        key === "opening_hours"
          ? {
              key: "opening_hours",
              value: {
                timezone: "Europe/Madrid",
                weekly: {
                  friday: [{ open: "20:00", close: "02:00" }],
                },
              },
            }
          : null,
      ),
    );

    await expect(
      service().isOpenNow(new Date("2026-08-28T11:00:00.000Z")),
    ).resolves.toBe(false);
  });

  it("closes service while manual pause is enabled", async () => {
    prisma.setting.findUnique.mockImplementation(({ where: { key } }) =>
      Promise.resolve(
        key === "orders_paused"
          ? { key, value: true }
          : key === "orders_pause_reason"
            ? { key, value: "Cerrado por mantenimiento." }
            : null,
      ),
    );

    await expect(
      service().getServiceStatus(new Date("2026-08-31T10:30:00.000Z")),
    ).resolves.toEqual(
      expect.objectContaining({
        openNow: false,
        reason: "Cerrado por mantenimiento.",
      }),
    );
  });

  it("closes service during an active special closure", async () => {
    prisma.specialClosure.findFirst.mockResolvedValue({
      id: "closure-1",
      startsAt: new Date("2026-08-31T09:00:00.000Z"),
      endsAt: new Date("2026-08-31T13:00:00.000Z"),
      reason: "Evento privado.",
      active: true,
      createdById: "admin-1",
      createdAt: new Date("2026-08-30T10:00:00.000Z"),
      updatedAt: new Date("2026-08-30T10:00:00.000Z"),
    });

    await expect(
      service().getServiceStatus(new Date("2026-08-31T10:30:00.000Z")),
    ).resolves.toEqual(
      expect.objectContaining({
        openNow: false,
        reason: "Evento privado.",
        activeClosure: {
          startsAt: new Date("2026-08-31T09:00:00.000Z"),
          endsAt: new Date("2026-08-31T13:00:00.000Z"),
          reason: "Evento privado.",
        },
      }),
    );
  });

  it("validates special closure ranges before saving", async () => {
    expect(() =>
      service().createSpecialClosure({
        startsAt: "2026-08-31T14:00:00.000Z",
        endsAt: "2026-08-31T13:00:00.000Z",
        reason: "Fechas cruzadas",
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      service().createSpecialClosure({
        startsAt: "2026-08-31T10:00:00.000Z",
        endsAt: "2026-08-31T13:00:00.000Z",
        reason: "   ",
      }),
    ).toThrow(BadRequestException);

    expect(prisma.specialClosure.create).not.toHaveBeenCalled();
  });
});

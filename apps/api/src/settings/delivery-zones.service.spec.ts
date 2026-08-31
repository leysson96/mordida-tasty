import { BadRequestException } from "@nestjs/common";
import { DeliveryZonesService } from "./delivery-zones.service";

describe("DeliveryZonesService", () => {
  const prisma = {
    deliveryZone: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const settings = {
    getDeliveryFeeCents: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    settings.getDeliveryFeeCents.mockResolvedValue(250);
  });

  function service() {
    return new DeliveryZonesService(prisma as never, settings as never);
  }

  it("uses the global delivery fee while no zones are configured", async () => {
    prisma.deliveryZone.findMany.mockResolvedValue([]);

    await expect(service().quoteDelivery("15001", 1190)).resolves.toEqual({
      available: true,
      deliveryFeeCents: 250,
      minimumOrderCents: 0,
    });
  });

  it("quotes an exact postal code zone", async () => {
    prisma.deliveryZone.findMany.mockResolvedValue([
      makeZone({ postalCodes: ["15001"], deliveryFeeCents: 390 }),
    ]);

    await expect(service().quoteDelivery("15001", 1190)).resolves.toEqual(
      expect.objectContaining({
        available: true,
        deliveryFeeCents: 390,
        minimumOrderCents: 0,
        zone: expect.objectContaining({ name: "Centro" }),
      }),
    );
  });

  it("quotes a postal code prefix zone", async () => {
    prisma.deliveryZone.findMany.mockResolvedValue([
      makeZone({ postalCodes: ["151*"], deliveryFeeCents: 490 }),
    ]);

    await expect(service().quoteDelivery("15142", 1190)).resolves.toEqual(
      expect.objectContaining({
        available: true,
        deliveryFeeCents: 490,
      }),
    );
  });

  it("rejects delivery outside active zones", async () => {
    prisma.deliveryZone.findMany.mockResolvedValue([
      makeZone({ postalCodes: ["15001"] }),
    ]);

    await expect(service().quoteDelivery("15999", 1190)).resolves.toEqual({
      available: false,
      deliveryFeeCents: 0,
      minimumOrderCents: 0,
      reason: "No repartimos en ese codigo postal.",
    });
  });

  it("rejects delivery below the zone minimum order", async () => {
    prisma.deliveryZone.findMany.mockResolvedValue([
      makeZone({ postalCodes: ["15001"], minimumOrderCents: 2000 }),
    ]);

    await expect(service().quoteDelivery("15001", 1190)).resolves.toEqual(
      expect.objectContaining({
        available: false,
        deliveryFeeCents: 250,
        minimumOrderCents: 2000,
        reason: expect.stringContaining("Pedido minimo para Centro:"),
      }),
    );
  });

  it("normalizes rules before creating a zone", async () => {
    const zone = makeZone({
      postalCodes: ["15001", "150*"],
      deliveryFeeCents: 350,
      minimumOrderCents: 1200,
    });
    prisma.deliveryZone.create.mockResolvedValue(zone);

    await expect(
      service().createZone({
        name: " Centro ",
        postalCodes: ["15001", " 150* "],
        deliveryFeeCents: 350,
        minimumOrderCents: 1200,
      }),
    ).resolves.toEqual(
      expect.objectContaining({ postalCodes: zone.postalCodes }),
    );

    expect(prisma.deliveryZone.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Centro",
          postalCodes: ["15001", "150*"],
          deliveryFeeCents: 350,
          minimumOrderCents: 1200,
          active: true,
          sortOrder: 0,
        }),
      }),
    );
  });

  it("rejects invalid postal rules before saving", async () => {
    await expect(
      service().createZone({
        name: "Centro",
        postalCodes: ["!"],
        deliveryFeeCents: 250,
        minimumOrderCents: 0,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.deliveryZone.create).not.toHaveBeenCalled();
  });
});

function makeZone(
  overrides: Partial<{
    id: string;
    name: string;
    postalCodes: string[];
    deliveryFeeCents: number;
    minimumOrderCents: number;
    active: boolean;
    sortOrder: number;
  }> = {},
) {
  return {
    id: overrides.id ?? "zone-1",
    name: overrides.name ?? "Centro",
    postalCodes: overrides.postalCodes ?? ["15001"],
    deliveryFeeCents: overrides.deliveryFeeCents ?? 250,
    minimumOrderCents: overrides.minimumOrderCents ?? 0,
    active: overrides.active ?? true,
    sortOrder: overrides.sortOrder ?? 0,
    createdAt: new Date("2026-08-30T10:00:00.000Z"),
    updatedAt: new Date("2026-08-30T10:00:00.000Z"),
  };
}

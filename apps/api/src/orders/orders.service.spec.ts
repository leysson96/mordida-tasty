import { BadRequestException } from "@nestjs/common";
import {
  DeliveryMethod,
  OrderPaymentMethod,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
} from "@prisma/client";
import { OrdersService } from "./orders.service";

describe("OrdersService", () => {
  const prisma = {
    order: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const settings = {
    getServiceStatus: jest.fn(),
    getTaxRate: jest.fn(),
  };

  const deliveryZones = {
    quoteDelivery: jest.fn(),
  };

  const config = {
    get: jest.fn((key: string) =>
      key === "APP_TIMEZONE" ? "Europe/Madrid" : undefined,
    ),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.order.findUnique.mockResolvedValue(null);
    prisma.order.findMany.mockResolvedValue([]);
    prisma.product.findMany.mockResolvedValue([]);
    prisma.$transaction.mockReset();
    settings.getServiceStatus.mockResolvedValue({ openNow: true });
    settings.getTaxRate.mockResolvedValue(0.1);
    deliveryZones.quoteDelivery.mockResolvedValue({
      available: true,
      deliveryFeeCents: 250,
      minimumOrderCents: 0,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function service() {
    return new OrdersService(
      prisma as never,
      settings as never,
      deliveryZones as never,
      config as never,
    );
  }

  it("rejects items from inactive products or inactive categories during checkout", async () => {
    const productId = "00000000-0000-4000-8000-000000000001";

    await expect(
      service().createOrder(
        {
          customerName: "Cliente Test",
          customerEmail: "cliente@example.com",
          customerPhone: "+34611752804",
          deliveryMethod: DeliveryMethod.PICKUP,
          items: [{ productId, quantity: 1 }],
          acceptLegal: true,
        },
        "checkout-idempotency-key",
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [productId] },
        active: true,
        category: {
          active: true,
        },
      },
      include: expect.any(Object),
    });
  });

  it("rejects checkout with the configured service closure reason", async () => {
    settings.getServiceStatus.mockResolvedValue({
      openNow: false,
      reason: "Cerrado por vacaciones.",
    });

    await expect(
      service().createOrder(
        {
          customerName: "Cliente Test",
          customerEmail: "cliente@example.com",
          customerPhone: "+34611752804",
          deliveryMethod: DeliveryMethod.PICKUP,
          items: [
            {
              productId: "00000000-0000-4000-8000-000000000001",
              quantity: 1,
            },
          ],
          acceptLegal: true,
        },
        "checkout-idempotency-key",
      ),
    ).rejects.toThrow("Cerrado por vacaciones.");

    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });

  it("blocks delivery checkout when the postal code is outside coverage", async () => {
    const productId = "00000000-0000-4000-8000-000000000001";
    prisma.product.findMany.mockResolvedValue([
      {
        id: productId,
        name: "Mordida Smash",
        priceCents: 1190,
        available: true,
        optionGroups: [],
      },
    ]);
    deliveryZones.quoteDelivery.mockResolvedValue({
      available: false,
      deliveryFeeCents: 0,
      minimumOrderCents: 0,
      reason: "No repartimos en ese codigo postal.",
    });

    await expect(
      service().createOrder(
        {
          customerName: "Cliente Test",
          customerEmail: "cliente@example.com",
          customerPhone: "+34611752804",
          deliveryMethod: DeliveryMethod.DELIVERY,
          address: {
            name: "Cliente Test",
            phone: "+34611752804",
            street: "Calle Real 1",
            city: "A Coruna",
            postalCode: "15999",
          },
          items: [{ productId, quantity: 1 }],
          acceptLegal: true,
        },
        "checkout-idempotency-key",
      ),
    ).rejects.toThrow("No repartimos en ese codigo postal.");

    expect(deliveryZones.quoteDelivery).toHaveBeenCalledWith("15999", 1190);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("uses the quoted zone delivery fee when creating delivery orders", async () => {
    const productId = "00000000-0000-4000-8000-000000000001";
    prisma.product.findMany.mockResolvedValue([
      {
        id: productId,
        name: "Mordida Smash",
        priceCents: 1190,
        available: true,
        optionGroups: [],
      },
    ]);
    deliveryZones.quoteDelivery.mockResolvedValue({
      available: true,
      deliveryFeeCents: 390,
      minimumOrderCents: 1500,
      zone: {
        id: "zone-1",
        name: "Centro",
        postalCodes: ["15001"],
        deliveryFeeCents: 390,
        minimumOrderCents: 1500,
        active: true,
        sortOrder: 0,
        createdAt: new Date("2026-08-30T10:00:00.000Z"),
        updatedAt: new Date("2026-08-30T10:00:00.000Z"),
      },
    });

    const tx = {
      sequenceCounter: {
        upsert: jest.fn().mockResolvedValue({ value: 7 }),
      },
      order: {
        create: jest.fn(({ data }) => ({
          id: "order-1",
          orderNumber: data.orderNumber,
          deliveryFeeCents: data.deliveryFeeCents,
          totalCents: data.totalCents,
          items: [],
          statusHistory: [],
        })),
      },
    };
    prisma.$transaction.mockImplementation((callback) => callback(tx));

    await expect(
      service().createOrder(
        {
          customerName: "Cliente Test",
          customerEmail: "cliente@example.com",
          customerPhone: "+34611752804",
          deliveryMethod: DeliveryMethod.DELIVERY,
          address: {
            name: "Cliente Test",
            phone: "+34611752804",
            street: "Calle Real 1",
            city: "A Coruna",
            postalCode: "15001",
          },
          items: [{ productId, quantity: 2 }],
          acceptLegal: true,
        },
        "checkout-idempotency-key",
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        deliveryFeeCents: 390,
        totalCents: 2770,
      }),
    );

    expect(deliveryZones.quoteDelivery).toHaveBeenCalledWith("15001", 2380);
    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deliveryFeeCents: 390,
          subtotalCents: 2380,
          totalCents: 2770,
        }),
      }),
    );
  });

  it("creates cash delivery orders as confirmed and stores change details", async () => {
    const productId = "00000000-0000-4000-8000-000000000001";
    prisma.product.findMany.mockResolvedValue([
      {
        id: productId,
        name: "Mordida Smash",
        priceCents: 1190,
        available: true,
        optionGroups: [],
      },
    ]);

    const tx = {
      sequenceCounter: {
        upsert: jest.fn().mockResolvedValue({ value: 9 }),
      },
      order: {
        create: jest.fn(({ data }) => ({
          id: "order-cash",
          orderNumber: data.orderNumber,
          status: data.status,
          paymentMethod: data.paymentMethod,
          cashTenderedCents: data.cashTenderedCents,
          cashChangeCents: data.cashChangeCents,
          totalCents: data.totalCents,
          items: [],
          statusHistory: [],
        })),
      },
    };
    prisma.$transaction.mockImplementation((callback) => callback(tx));

    await expect(
      service().createOrder(
        {
          customerName: "Cliente Test",
          customerEmail: "cliente@example.com",
          customerPhone: "+34611752804",
          deliveryMethod: DeliveryMethod.DELIVERY,
          paymentMethod: OrderPaymentMethod.CASH,
          cashTenderedCents: 2000,
          address: {
            name: "Cliente Test",
            phone: "+34611752804",
            street: "Calle Real 1",
            city: "A Coruna",
            postalCode: "15001",
          },
          items: [{ productId, quantity: 1 }],
          acceptLegal: true,
        },
        "checkout-cash-key",
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        status: OrderStatus.CONFIRMED,
        paymentMethod: OrderPaymentMethod.CASH,
        cashTenderedCents: 2000,
        cashChangeCents: 560,
        totalCents: 1440,
      }),
    );

    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OrderStatus.CONFIRMED,
          paymentMethod: OrderPaymentMethod.CASH,
          cashTenderedCents: 2000,
          cashChangeCents: 560,
          payments: {
            create: {
              provider: PaymentProvider.CASH,
              status: PaymentStatus.PENDING,
              amountCents: 1440,
              currency: "eur",
            },
          },
          statusHistory: {
            create: expect.arrayContaining([
              expect.objectContaining({
                toStatus: OrderStatus.CREATED,
              }),
              expect.objectContaining({
                fromStatus: OrderStatus.CREATED,
                toStatus: OrderStatus.CONFIRMED,
              }),
            ]),
          },
        }),
      }),
    );
  });

  it("rejects cash delivery orders when the tendered amount is too low", async () => {
    const productId = "00000000-0000-4000-8000-000000000001";
    prisma.product.findMany.mockResolvedValue([
      {
        id: productId,
        name: "Mordida Smash",
        priceCents: 1190,
        available: true,
        optionGroups: [],
      },
    ]);

    await expect(
      service().createOrder(
        {
          customerName: "Cliente Test",
          customerEmail: "cliente@example.com",
          customerPhone: "+34611752804",
          deliveryMethod: DeliveryMethod.DELIVERY,
          paymentMethod: OrderPaymentMethod.CASH,
          cashTenderedCents: 1000,
          address: {
            name: "Cliente Test",
            phone: "+34611752804",
            street: "Calle Real 1",
            city: "A Coruna",
            postalCode: "15001",
          },
          items: [{ productId, quantity: 1 }],
          acceptLegal: true,
        },
        "checkout-cash-low-key",
      ),
    ).rejects.toThrow(
      "El importe en efectivo debe cubrir el total del pedido.",
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("adds selected option prices and saves option snapshots on order items", async () => {
    const productId = "00000000-0000-4000-8000-000000000001";
    const pointGroupId = "00000000-0000-4000-8000-000000000010";
    const mediumChoiceId = "00000000-0000-4000-8000-000000000011";
    const extrasGroupId = "00000000-0000-4000-8000-000000000020";
    const baconChoiceId = "00000000-0000-4000-8000-000000000021";
    const cheddarChoiceId = "00000000-0000-4000-8000-000000000022";

    prisma.product.findMany.mockResolvedValue([
      {
        id: productId,
        name: "Mordida Smash",
        priceCents: 1190,
        available: true,
        optionGroups: [
          {
            id: pointGroupId,
            name: "Punto",
            required: true,
            minChoices: 1,
            maxChoices: 1,
            choices: [
              {
                id: mediumChoiceId,
                name: "Al punto",
                priceCents: 0,
              },
            ],
          },
          {
            id: extrasGroupId,
            name: "Extras",
            required: false,
            minChoices: 0,
            maxChoices: 2,
            choices: [
              {
                id: baconChoiceId,
                name: "Bacon",
                priceCents: 150,
              },
              {
                id: cheddarChoiceId,
                name: "Cheddar",
                priceCents: 100,
              },
            ],
          },
        ],
      },
    ]);

    const tx = {
      sequenceCounter: {
        upsert: jest.fn().mockResolvedValue({ value: 8 }),
      },
      order: {
        create: jest.fn(({ data }) => ({
          id: "order-1",
          orderNumber: data.orderNumber,
          subtotalCents: data.subtotalCents,
          totalCents: data.totalCents,
          items: data.items.create,
          statusHistory: [],
        })),
      },
    };
    prisma.$transaction.mockImplementation((callback) => callback(tx));

    await expect(
      service().createOrder(
        {
          customerName: "Cliente Test",
          customerEmail: "cliente@example.com",
          customerPhone: "+34611752804",
          deliveryMethod: DeliveryMethod.PICKUP,
          items: [
            {
              productId,
              quantity: 2,
              options: [
                { groupId: pointGroupId, choiceIds: [mediumChoiceId] },
                {
                  groupId: extrasGroupId,
                  choiceIds: [baconChoiceId, cheddarChoiceId],
                },
              ],
            },
          ],
          acceptLegal: true,
        },
        "checkout-options-key",
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        subtotalCents: 2880,
        totalCents: 2880,
      }),
    );

    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotalCents: 2880,
          totalCents: 2880,
          items: {
            create: [
              expect.objectContaining({
                productId,
                unitPriceCents: 1440,
                quantity: 2,
                lineTotalCents: 2880,
                options: {
                  create: expect.arrayContaining([
                    {
                      groupName: "Punto",
                      choiceName: "Al punto",
                      priceCents: 0,
                    },
                    {
                      groupName: "Extras",
                      choiceName: "Bacon",
                      priceCents: 150,
                    },
                    {
                      groupName: "Extras",
                      choiceName: "Cheddar",
                      priceCents: 100,
                    },
                  ]),
                },
              }),
            ],
          },
        }),
      }),
    );
  });

  it("rejects orders that miss required product options", async () => {
    const productId = "00000000-0000-4000-8000-000000000001";

    prisma.product.findMany.mockResolvedValue([
      {
        id: productId,
        name: "Mordida Smash",
        priceCents: 1190,
        available: true,
        optionGroups: [
          {
            id: "00000000-0000-4000-8000-000000000010",
            name: "Punto",
            required: true,
            minChoices: 1,
            maxChoices: 1,
            choices: [
              {
                id: "00000000-0000-4000-8000-000000000011",
                name: "Al punto",
                priceCents: 0,
              },
            ],
          },
        ],
      },
    ]);

    await expect(
      service().createOrder(
        {
          customerName: "Cliente Test",
          customerEmail: "cliente@example.com",
          customerPhone: "+34611752804",
          deliveryMethod: DeliveryMethod.PICKUP,
          items: [{ productId, quantity: 1 }],
          acceptLegal: true,
        },
        "checkout-required-options-key",
      ),
    ).rejects.toThrow("Selecciona al menos 1 opcion(es) de Punto.");

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("uses the configured business timezone for the admin today filter", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-29T22:30:00.000Z"));

    await service().listAdminOrders({ today: true });

    const createdAt = prisma.order.findMany.mock.calls[0][0].where.createdAt;
    expect(createdAt.gte).toEqual(new Date("2026-08-29T22:00:00.000Z"));
    expect(createdAt.lt).toEqual(new Date("2026-08-30T22:00:00.000Z"));
  });

  it("filters admin orders by text, status, delivery method, date range and page", async () => {
    await service().listAdminOrders({
      q: "leysson",
      status: OrderStatus.PAID,
      deliveryMethod: DeliveryMethod.DELIVERY,
      from: "2026-08-01",
      to: "2026-08-02",
      page: "2",
      pageSize: "25",
    });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: OrderStatus.PAID,
          deliveryMethod: DeliveryMethod.DELIVERY,
          createdAt: {
            gte: new Date("2026-07-31T22:00:00.000Z"),
            lt: new Date("2026-08-02T22:00:00.000Z"),
          },
          OR: expect.arrayContaining([
            { orderNumber: { contains: "leysson", mode: "insensitive" } },
            { customerEmail: { contains: "leysson", mode: "insensitive" } },
            { customerName: { contains: "leysson", mode: "insensitive" } },
            { customerPhone: { contains: "leysson" } },
          ]),
        }),
        skip: 25,
        take: 25,
      }),
    );
  });

  it("groups sales reports by local business day", async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        createdAt: new Date("2026-08-29T22:30:00.000Z"),
        status: OrderStatus.PAID,
        totalCents: 1200,
        items: [],
      },
    ]);

    const report = await service().salesReport({
      from: "2026-08-30",
      to: "2026-08-30",
    });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date("2026-08-29T22:00:00.000Z"),
            lt: new Date("2026-08-30T22:00:00.000Z"),
          },
        }),
      }),
    );
    expect(report.salesByDay).toEqual([
      {
        date: "2026-08-30",
        revenueCents: 1200,
        orderCount: 1,
      },
    ]);
  });
});

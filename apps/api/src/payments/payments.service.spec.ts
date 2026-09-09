import { BadRequestException } from "@nestjs/common";
import {
  OrderPaymentMethod,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { PaymentsService } from "./payments.service";

describe("PaymentsService", () => {
  const prisma = {
    stripeEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    orderItem: {
      update: jest.fn(),
    },
    orderStatusHistory: {
      create: jest.fn(),
    },
    paymentRefund: {
      upsert: jest.fn(),
      aggregate: jest.fn(),
    },
    loyaltyRedemption: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const ordersService = {
    getForCheckout: jest.fn(),
    transitionOrder: jest.fn(),
  };

  const settingsService = {
    getServiceStatus: jest.fn(),
  };

  const mailService = {
    sendOrderReceiptEmail: jest.fn(),
  };

  const stripe = {
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
    coupons: {
      create: jest.fn(),
    },
    refunds: {
      create: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  };

  const configValues: Record<string, string | number | undefined> = {
    STRIPE_WEBHOOK_SECRET: "whsec_test",
    FRONTEND_URL: "https://mordida.test",
    STRIPE_SUCCESS_PATH: "/seguimiento/{ORDER_NUMBER}?t={TRACKING_TOKEN}",
    STRIPE_CANCEL_PATH: "/carrito",
    CHECKOUT_GRACE_MINUTES: 15,
  };

  const config = {
    get: jest.fn((key: string) => configValues[key]),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (
        input:
          | Promise<unknown>[]
          | ((transactionClient: typeof prisma) => Promise<unknown>),
      ) => {
        if (Array.isArray(input)) {
          return Promise.all(input);
        }

        return input(prisma);
      },
    );
    prisma.stripeEvent.findUnique.mockResolvedValue(null);
    prisma.stripeEvent.create.mockResolvedValue({});
    prisma.stripeEvent.update.mockResolvedValue({});
    prisma.order.update.mockResolvedValue({});
    prisma.payment.upsert.mockResolvedValue({});
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    prisma.payment.update.mockResolvedValue({});
    prisma.payment.create.mockResolvedValue({});
    prisma.orderItem.update.mockResolvedValue({});
    prisma.orderStatusHistory.create.mockResolvedValue({});
    prisma.paymentRefund.upsert.mockResolvedValue({});
    prisma.paymentRefund.aggregate.mockResolvedValue({
      _sum: { amountCents: 0 },
    });
    prisma.loyaltyRedemption.updateMany.mockResolvedValue({ count: 0 });
    settingsService.getServiceStatus.mockResolvedValue({
      openNow: true,
      pause: { paused: false, reason: "" },
    });
    configValues.CHECKOUT_GRACE_MINUTES = 15;
    stripe.coupons.create.mockResolvedValue({ id: "coupon_123" });
    stripe.refunds.create.mockResolvedValue({ id: "re_123" });
  });

  function service() {
    const paymentsService = new PaymentsService(
      prisma as never,
      ordersService as never,
      mailService as never,
      config as never,
      settingsService as never,
    );
    (paymentsService as unknown as { stripe: typeof stripe }).stripe = stripe;
    return paymentsService;
  }

  function signedStripeRequest() {
    return {
      rawBody: Buffer.from("{}"),
      headers: { "stripe-signature": "test_signature" },
    };
  }

  it("ignores duplicate Stripe webhook events that were already processed", async () => {
    prisma.stripeEvent.findUnique.mockResolvedValue({
      id: "evt_duplicate",
      processedAt: new Date(),
    });
    stripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_duplicate",
      type: "checkout.session.completed",
      data: { object: { id: "cs_duplicate" } },
    });

    await expect(
      service().handleWebhook(signedStripeRequest() as never),
    ).resolves.toEqual({
      received: true,
      duplicate: true,
    });

    expect(ordersService.transitionOrder).not.toHaveBeenCalled();
    expect(prisma.stripeEvent.update).not.toHaveBeenCalled();
  });

  it("treats a concurrent duplicate Stripe webhook insert as already received", async () => {
    prisma.stripeEvent.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on StripeEvent.id",
        {
          code: "P2002",
          clientVersion: "test",
        },
      ),
    );
    stripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_duplicate_race",
      type: "checkout.session.completed",
      data: { object: { id: "cs_duplicate_race" } },
    });

    await expect(
      service().handleWebhook(signedStripeRequest() as never),
    ).resolves.toEqual({
      received: true,
      duplicate: true,
    });

    expect(ordersService.transitionOrder).not.toHaveBeenCalled();
    expect(prisma.stripeEvent.update).not.toHaveBeenCalled();
  });

  it("records a late paid checkout for a cancelled order without sending it to kitchen", async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_late_paid",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_late_paid",
          client_reference_id: "order-1",
          metadata: { orderId: "order-1" },
          payment_intent: "pi_late_paid",
        },
      },
    });
    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      orderNumber: "MT-0001",
      status: OrderStatus.CANCELLED,
      totalCents: 1440,
      currency: "eur",
    });

    await expect(
      service().handleWebhook(signedStripeRequest() as never),
    ).resolves.toEqual({ received: true });

    expect(prisma.payment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: PaymentStatus.SUCCEEDED }),
      }),
    );
    expect(ordersService.transitionOrder).not.toHaveBeenCalled();
    expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: "order-1",
        fromStatus: OrderStatus.CANCELLED,
        toStatus: OrderStatus.CANCELLED,
      }),
    });
  });

  it("moves a pending order to paid when Stripe confirms checkout even if the store is closed", async () => {
    settingsService.getServiceStatus.mockResolvedValue({
      openNow: false,
      reason: "Fuera de horario de pedidos.",
      pause: { paused: false, reason: "" },
    });
    stripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_paid",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_paid",
          client_reference_id: "order-1",
          metadata: { orderId: "order-1" },
          payment_intent: "pi_paid",
        },
      },
    });
    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      orderNumber: "MT-0001",
      status: OrderStatus.PENDING_PAYMENT,
      totalCents: 1440,
      currency: "eur",
    });
    prisma.order.findUniqueOrThrow.mockResolvedValue({
      id: "order-1",
      orderNumber: "MT-0001",
      trackingToken: "track_123",
      customerEmail: "cliente@example.com",
      customerName: "Cliente Test",
      customerPhone: "+34611752804",
      deliveryMethod: "PICKUP",
      paymentMethod: "CARD",
      subtotalCents: 1440,
      discountCents: 0,
      deliveryFeeCents: 0,
      taxCents: 131,
      totalCents: 1440,
      createdAt: new Date("2026-08-31T20:00:00.000Z"),
      items: [
        {
          productName: "Mordida Smash",
          quantity: 1,
          lineTotalCents: 1440,
          options: [],
        },
      ],
    });

    await service().handleWebhook(signedStripeRequest() as never);

    expect(ordersService.transitionOrder).toHaveBeenCalledWith(
      "order-1",
      OrderStatus.PAID,
      undefined,
      "Stripe checkout completed: cs_paid",
    );
    expect(mailService.sendOrderReceiptEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        orderNumber: "MT-0001",
        customerEmail: "cliente@example.com",
      }),
    );
    expect(settingsService.getServiceStatus).not.toHaveBeenCalled();
  });

  it("expires unpaid orders when Stripe checkout expires", async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_expired",
      type: "checkout.session.expired",
      data: {
        object: {
          id: "cs_expired",
          client_reference_id: "order-1",
          metadata: { orderId: "order-1" },
        },
      },
    });
    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      status: OrderStatus.PENDING_PAYMENT,
    });

    await service().handleWebhook(signedStripeRequest() as never);

    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { stripeSessionId: "cs_expired" },
      data: { status: PaymentStatus.EXPIRED },
    });
    expect(ordersService.transitionOrder).toHaveBeenCalledWith(
      "order-1",
      OrderStatus.EXPIRED,
      undefined,
      "Stripe checkout expired: cs_expired",
    );
  });

  it("marks pending payments as failed when Stripe reports a failed intent", async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_failed",
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_failed",
        },
      },
    });
    prisma.order.findFirst.mockResolvedValue({
      id: "order-1",
      status: OrderStatus.PENDING_PAYMENT,
    });

    await service().handleWebhook(signedStripeRequest() as never);

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { stripePaymentIntentId: "pi_failed" },
    });
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: {
        orderId: "order-1",
        OR: [
          { stripePaymentIntentId: "pi_failed" },
          {
            stripePaymentIntentId: null,
            status: PaymentStatus.PENDING,
          },
        ],
      },
      data: {
        status: PaymentStatus.FAILED,
        stripePaymentIntentId: "pi_failed",
      },
    });
    expect(ordersService.transitionOrder).toHaveBeenCalledWith(
      "order-1",
      OrderStatus.PAYMENT_FAILED,
      undefined,
      "Stripe payment failed: pi_failed",
    );
  });

  it("finds a failed Stripe payment by metadata when the intent id was not stored", async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_failed_metadata",
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_failed_late",
          metadata: {
            orderId: "order-1",
            orderNumber: "MT-0001",
            trackingToken: "track_123",
          },
        },
      },
    });
    prisma.order.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "order-1",
        orderNumber: "MT-0001",
        trackingToken: "track_123",
        status: OrderStatus.PENDING_PAYMENT,
      });

    await service().handleWebhook(signedStripeRequest() as never);

    expect(prisma.order.findFirst).toHaveBeenNthCalledWith(1, {
      where: { stripePaymentIntentId: "pi_failed_late" },
    });
    expect(prisma.order.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        id: "order-1",
        orderNumber: "MT-0001",
        trackingToken: "track_123",
      },
    });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { stripePaymentIntentId: "pi_failed_late" },
    });
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: {
        orderId: "order-1",
        OR: [
          { stripePaymentIntentId: "pi_failed_late" },
          {
            stripePaymentIntentId: null,
            status: PaymentStatus.PENDING,
          },
        ],
      },
      data: {
        status: PaymentStatus.FAILED,
        stripePaymentIntentId: "pi_failed_late",
      },
    });
    expect(ordersService.transitionOrder).toHaveBeenCalledWith(
      "order-1",
      OrderStatus.PAYMENT_FAILED,
      undefined,
      "Stripe payment failed: pi_failed_late",
    );
  });

  it("creates checkout sessions with Stripe idempotency tied to the order", async () => {
    ordersService.getForCheckout.mockResolvedValue({
      id: "order-1",
      orderNumber: "MT-0001",
      trackingToken: "track_123",
      status: OrderStatus.CREATED,
      createdAt: new Date("2026-09-01T19:00:00.000Z"),
      stripeSessionId: null,
      paymentMethod: OrderPaymentMethod.CARD,
      customerEmail: "cliente@example.com",
      currency: "eur",
      discountCents: 0,
      totalCents: 1440,
      deliveryFeeCents: 250,
      items: [
        {
          id: "item-1",
          productName: "Mordida Smash",
          quantity: 1,
          unitPriceCents: 1340,
          removedAt: null,
          options: [
            {
              groupName: "Extras",
              choiceName: "Bacon",
            },
          ],
        },
      ],
    });
    stripe.checkout.sessions.create.mockResolvedValue({
      id: "cs_123",
      url: "https://stripe.test/checkout",
      payment_intent: "pi_123",
      expires_at: 1_787_000_000,
    });

    await expect(
      service().createCheckoutSession({
        orderId: "order-1",
        trackingToken: "track_123",
      }),
    ).resolves.toEqual({
      orderNumber: "MT-0001",
      checkoutUrl: "https://stripe.test/checkout",
    });

    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        client_reference_id: "order-1",
        success_url: "https://mordida.test/seguimiento/MT-0001?t=track_123",
        metadata: {
          orderId: "order-1",
          orderNumber: "MT-0001",
          trackingToken: "track_123",
        },
        payment_intent_data: {
          metadata: {
            orderId: "order-1",
            orderNumber: "MT-0001",
            trackingToken: "track_123",
          },
        },
        line_items: expect.arrayContaining([
          expect.objectContaining({
            price_data: expect.objectContaining({
              product_data: {
                name: "Mordida Smash (Extras: Bacon)",
              },
            }),
          }),
        ]),
      }),
      { idempotencyKey: "checkout:order-1" },
    );
  });

  it("rejects checkout when the tracking token is wrong", async () => {
    ordersService.getForCheckout.mockResolvedValue({
      id: "order-1",
      orderNumber: "MT-0001",
      trackingToken: "track_123",
      status: OrderStatus.CREATED,
      createdAt: new Date("2026-09-01T19:00:00.000Z"),
      stripeSessionId: null,
      paymentMethod: OrderPaymentMethod.CARD,
      items: [{ removedAt: null }],
    });

    await expect(
      service().createCheckoutSession({
        orderId: "order-1",
        trackingToken: "wrong_tracking_token_value_123",
      }),
    ).rejects.toThrow("Order not found.");

    expect(settingsService.getServiceStatus).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("rejects checkout when the tracking token is missing", async () => {
    ordersService.getForCheckout.mockResolvedValue({
      id: "order-1",
      orderNumber: "MT-0001",
      trackingToken: "track_123",
      status: OrderStatus.CREATED,
      createdAt: new Date("2026-09-01T19:00:00.000Z"),
      stripeSessionId: null,
      paymentMethod: OrderPaymentMethod.CARD,
      items: [{ removedAt: null }],
    });

    await expect(
      service().createCheckoutSession({ orderId: "order-1" } as never),
    ).rejects.toThrow("Order not found.");

    expect(settingsService.getServiceStatus).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it.each([OrderStatus.CANCELLED, OrderStatus.EXPIRED])(
    "rejects checkout when the order is %s",
    async (status) => {
      ordersService.getForCheckout.mockResolvedValue({
        id: "order-1",
        orderNumber: "MT-0001",
        trackingToken: "track_123",
        status,
        paymentMethod: OrderPaymentMethod.CARD,
        items: [{ removedAt: null }],
      });

      await expect(
        service().createCheckoutSession({
          orderId: "order-1",
          trackingToken: "track_123",
        }),
      ).rejects.toThrow("Order is no longer payable.");

      expect(settingsService.getServiceStatus).not.toHaveBeenCalled();
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    },
  );

  it("allows checkout for a recent order when the store is closed inside the grace window", async () => {
    settingsService.getServiceStatus.mockResolvedValue({
      openNow: false,
      reason: "Fuera de horario de pedidos.",
      pause: { paused: false, reason: "" },
    });
    ordersService.getForCheckout.mockResolvedValue({
      id: "order-1",
      orderNumber: "MT-0001",
      trackingToken: "track_123",
      status: OrderStatus.CREATED,
      createdAt: new Date(Date.now() - 5 * 60_000),
      stripeSessionId: null,
      paymentMethod: OrderPaymentMethod.CARD,
      customerEmail: "cliente@example.com",
      currency: "eur",
      discountCents: 0,
      totalCents: 1440,
      deliveryFeeCents: 0,
      items: [
        {
          id: "item-1",
          productName: "Mordida Smash",
          quantity: 1,
          unitPriceCents: 1440,
          removedAt: null,
          options: [],
        },
      ],
    });
    stripe.checkout.sessions.create.mockResolvedValue({
      id: "cs_123",
      url: "https://stripe.test/checkout",
      payment_intent: "pi_123",
      expires_at: 1_787_000_000,
    });

    await expect(
      service().createCheckoutSession({
        orderId: "order-1",
        trackingToken: "track_123",
      }),
    ).resolves.toEqual({
      orderNumber: "MT-0001",
      checkoutUrl: "https://stripe.test/checkout",
    });

    expect(stripe.checkout.sessions.create).toHaveBeenCalled();
    expect(ordersService.transitionOrder).not.toHaveBeenCalledWith(
      "order-1",
      OrderStatus.EXPIRED,
      undefined,
      expect.any(String),
    );
  });

  it("expires an unpaid order and rejects checkout when the store is closed outside the grace window", async () => {
    settingsService.getServiceStatus.mockResolvedValue({
      openNow: false,
      reason: "Fuera de horario de pedidos.",
      pause: { paused: false, reason: "" },
    });
    ordersService.getForCheckout.mockResolvedValue({
      id: "order-1",
      orderNumber: "MT-0001",
      trackingToken: "track_123",
      status: OrderStatus.CREATED,
      createdAt: new Date(Date.now() - 16 * 60_000),
      stripeSessionId: null,
      paymentMethod: OrderPaymentMethod.CARD,
      customerEmail: "cliente@example.com",
      currency: "eur",
      discountCents: 0,
      totalCents: 1440,
      deliveryFeeCents: 0,
      items: [
        {
          id: "item-1",
          productName: "Mordida Smash",
          quantity: 1,
          unitPriceCents: 1440,
          removedAt: null,
          options: [],
        },
      ],
    });

    await expect(
      service().createCheckoutSession({
        orderId: "order-1",
        trackingToken: "track_123",
      }),
    ).rejects.toThrow(
      "El plazo para pagar este pedido ha expirado porque la tienda esta cerrada.",
    );

    expect(ordersService.transitionOrder).toHaveBeenCalledWith(
      "order-1",
      OrderStatus.EXPIRED,
      undefined,
      "Checkout rechazado fuera de ventana de gracia (15 min). Fuera de horario de pedidos.",
    );
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("rejects closed checkout outside grace without expiring an order that already has a Stripe session", async () => {
    settingsService.getServiceStatus.mockResolvedValue({
      openNow: false,
      reason: "Fuera de horario de pedidos.",
      pause: { paused: false, reason: "" },
    });
    ordersService.getForCheckout.mockResolvedValue({
      id: "order-1",
      orderNumber: "MT-0001",
      trackingToken: "track_123",
      status: OrderStatus.PENDING_PAYMENT,
      createdAt: new Date(Date.now() - 16 * 60_000),
      stripeSessionId: "cs_existing",
      paymentMethod: OrderPaymentMethod.CARD,
      customerEmail: "cliente@example.com",
      currency: "eur",
      discountCents: 0,
      totalCents: 1440,
      deliveryFeeCents: 0,
      items: [
        {
          id: "item-1",
          productName: "Mordida Smash",
          quantity: 1,
          unitPriceCents: 1440,
          removedAt: null,
          options: [],
        },
      ],
    });

    await expect(
      service().createCheckoutSession({
        orderId: "order-1",
        trackingToken: "track_123",
      }),
    ).rejects.toThrow(
      "El plazo para pagar este pedido ha expirado porque la tienda esta cerrada.",
    );

    expect(ordersService.transitionOrder).not.toHaveBeenCalledWith(
      "order-1",
      OrderStatus.EXPIRED,
      undefined,
      expect.any(String),
    );
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("adds a Stripe coupon when the order has a loyalty discount", async () => {
    ordersService.getForCheckout.mockResolvedValue({
      id: "order-1",
      orderNumber: "MT-0001",
      trackingToken: "track_123",
      status: OrderStatus.CREATED,
      createdAt: new Date("2026-09-01T19:00:00.000Z"),
      stripeSessionId: null,
      paymentMethod: OrderPaymentMethod.CARD,
      customerEmail: "cliente@example.com",
      currency: "eur",
      discountCents: 119,
      totalCents: 1071,
      deliveryFeeCents: 0,
      items: [
        {
          id: "item-1",
          productName: "Mordida Smash",
          quantity: 1,
          unitPriceCents: 1190,
          removedAt: null,
          options: [],
        },
      ],
    });
    stripe.coupons.create.mockResolvedValue({ id: "coupon_loyalty" });
    stripe.checkout.sessions.create.mockResolvedValue({
      id: "cs_123",
      url: "https://stripe.test/checkout",
      payment_intent: "pi_123",
      expires_at: 1_787_000_000,
    });

    await service().createCheckoutSession({
      orderId: "order-1",
      trackingToken: "track_123",
    });

    expect(stripe.coupons.create).toHaveBeenCalledWith(
      {
        amount_off: 119,
        currency: "eur",
        duration: "once",
        name: "Mordida Club",
      },
      { idempotencyKey: "loyalty-coupon:order-1" },
    );
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        discounts: [{ coupon: "coupon_loyalty" }],
      }),
      { idempotencyKey: "checkout:order-1" },
    );
  });

  it("marks zero-total loyalty orders as paid without opening Stripe", async () => {
    ordersService.getForCheckout.mockResolvedValue({
      id: "order-1",
      orderNumber: "MT-0001",
      trackingToken: "track_123",
      status: OrderStatus.CREATED,
      createdAt: new Date("2026-09-01T19:00:00.000Z"),
      stripeSessionId: null,
      paymentMethod: OrderPaymentMethod.CARD,
      customerEmail: "cliente@example.com",
      currency: "eur",
      discountCents: 1190,
      totalCents: 0,
      deliveryFeeCents: 0,
      items: [
        {
          id: "item-1",
          productName: "Mordida Smash",
          quantity: 1,
          unitPriceCents: 1190,
          removedAt: null,
          options: [],
        },
      ],
    });
    prisma.order.findUniqueOrThrow.mockResolvedValue({
      id: "order-1",
      orderNumber: "MT-0001",
      trackingToken: "track_123",
      customerEmail: "cliente@example.com",
      customerName: "Cliente Test",
      customerPhone: "+34611752804",
      deliveryMethod: "PICKUP",
      paymentMethod: "CARD",
      subtotalCents: 1190,
      discountCents: 1190,
      deliveryFeeCents: 0,
      taxCents: 0,
      totalCents: 0,
      createdAt: new Date("2026-08-31T20:00:00.000Z"),
      items: [
        {
          productName: "Mordida Smash",
          quantity: 1,
          lineTotalCents: 1190,
          options: [],
        },
      ],
    });

    await expect(
      service().createCheckoutSession({
        orderId: "order-1",
        trackingToken: "track_123",
      }),
    ).resolves.toEqual({
      orderNumber: "MT-0001",
      checkoutUrl: "https://mordida.test/seguimiento/MT-0001?t=track_123",
    });

    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    expect(stripe.coupons.create).not.toHaveBeenCalled();
    expect(ordersService.transitionOrder).toHaveBeenCalledWith(
      "order-1",
      OrderStatus.PENDING_PAYMENT,
      undefined,
      "Pedido cubierto por premio de fidelidad",
    );
    expect(ordersService.transitionOrder).toHaveBeenCalledWith(
      "order-1",
      OrderStatus.PAID,
      undefined,
      "Pedido cubierto por premio de fidelidad",
    );
    expect(prisma.loyaltyRedemption.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          orderId: "order-1",
          status: "RESERVED",
        },
      }),
    );
    expect(mailService.sendOrderReceiptEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        orderNumber: "MT-0001",
        discountCents: 1190,
        totalCents: 0,
      }),
    );
  });

  it("rejects checkout when all order items were removed", async () => {
    ordersService.getForCheckout.mockResolvedValue({
      id: "order-1",
      trackingToken: "track_123",
      status: OrderStatus.CREATED,
      items: [{ removedAt: new Date() }],
    });

    await expect(
      service().createCheckoutSession({
        orderId: "order-1",
        trackingToken: "track_123",
      }),
    ).rejects.toThrow(BadRequestException);

    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("rejects Stripe checkout for cash orders", async () => {
    ordersService.getForCheckout.mockResolvedValue({
      id: "order-1",
      trackingToken: "track_123",
      status: OrderStatus.CREATED,
      paymentMethod: OrderPaymentMethod.CASH,
      items: [{ removedAt: null }],
    });

    await expect(
      service().createCheckoutSession({
        orderId: "order-1",
        trackingToken: "track_123",
      }),
    ).rejects.toThrow("Este pedido se pagara en efectivo");

    expect(ordersService.transitionOrder).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("marks a pending cash payment as collected", async () => {
    const summary = {
      id: "order-cash",
      orderNumber: "MT-0001",
      items: [],
      statusHistory: [],
    };
    prisma.order.findUnique.mockResolvedValue({
      id: "order-cash",
      orderNumber: "MT-0001",
      status: OrderStatus.CONFIRMED,
      paymentMethod: OrderPaymentMethod.CASH,
      totalCents: 1440,
      currency: "eur",
      paidAt: null,
      payments: [
        {
          id: "payment-cash",
          provider: PaymentProvider.CASH,
          status: PaymentStatus.PENDING,
          amountCents: 1440,
        },
      ],
    });
    prisma.order.findUniqueOrThrow.mockResolvedValue(summary);

    await expect(
      service().markCashPaymentCollected({
        orderId: "order-cash",
        actorId: "admin-1",
      }),
    ).resolves.toEqual({
      order: summary,
      paymentId: "payment-cash",
      amountCents: 1440,
    });

    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: "payment-cash" },
      data: { status: PaymentStatus.SUCCEEDED },
    });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-cash" },
      data: { paidAt: expect.any(Date) },
    });
    expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
      data: {
        orderId: "order-cash",
        fromStatus: OrderStatus.CONFIRMED,
        toStatus: OrderStatus.CONFIRMED,
        changedById: "admin-1",
        note: "Pago en efectivo cobrado.",
      },
    });
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("returns the order without duplicating history when cash was already collected", async () => {
    const paidAt = new Date("2026-09-09T12:00:00.000Z");
    const summary = {
      id: "order-cash",
      orderNumber: "MT-0001",
      items: [],
      statusHistory: [],
    };
    prisma.order.findUnique.mockResolvedValue({
      id: "order-cash",
      status: OrderStatus.DELIVERED,
      paymentMethod: OrderPaymentMethod.CASH,
      totalCents: 1440,
      currency: "eur",
      paidAt,
      payments: [
        {
          id: "payment-cash",
          provider: PaymentProvider.CASH,
          status: PaymentStatus.SUCCEEDED,
          amountCents: 1440,
        },
      ],
    });
    prisma.order.findUniqueOrThrow.mockResolvedValue(summary);

    await expect(
      service().markCashPaymentCollected({
        orderId: "order-cash",
        actorId: "admin-1",
      }),
    ).resolves.toEqual({
      order: summary,
      paymentId: "payment-cash",
      amountCents: 1440,
    });

    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(prisma.orderStatusHistory.create).not.toHaveBeenCalled();
  });

  it("creates a succeeded cash payment when a legacy cash order has no payment row", async () => {
    const summary = {
      id: "order-cash",
      orderNumber: "MT-0001",
      items: [],
      statusHistory: [],
    };
    prisma.order.findUnique.mockResolvedValue({
      id: "order-cash",
      status: OrderStatus.READY,
      paymentMethod: OrderPaymentMethod.CASH,
      totalCents: 1440,
      currency: "eur",
      paidAt: null,
      payments: [],
    });
    prisma.payment.create.mockResolvedValue({
      id: "payment-new",
      amountCents: 1440,
    });
    prisma.order.findUniqueOrThrow.mockResolvedValue(summary);

    await expect(
      service().markCashPaymentCollected({
        orderId: "order-cash",
        actorId: "admin-1",
      }),
    ).resolves.toEqual({
      order: summary,
      paymentId: "payment-new",
      amountCents: 1440,
    });

    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: {
        orderId: "order-cash",
        provider: PaymentProvider.CASH,
        status: PaymentStatus.SUCCEEDED,
        amountCents: 1440,
        currency: "eur",
      },
    });
  });

  it("rejects marking card orders as cash collected", async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: "order-card",
      status: OrderStatus.CONFIRMED,
      paymentMethod: OrderPaymentMethod.CARD,
      payments: [],
    });

    await expect(
      service().markCashPaymentCollected({
        orderId: "order-card",
        actorId: "admin-1",
      }),
    ).rejects.toThrow(
      "Solo se pueden marcar como cobrados pedidos en efectivo.",
    );

    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.orderStatusHistory.create).not.toHaveBeenCalled();
  });

  it("rejects collecting cash for cancelled orders", async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: "order-cancelled",
      status: OrderStatus.CANCELLED,
      paymentMethod: OrderPaymentMethod.CASH,
      payments: [
        {
          id: "payment-cash",
          provider: PaymentProvider.CASH,
          status: PaymentStatus.PENDING,
          amountCents: 1440,
        },
      ],
    });

    await expect(
      service().markCashPaymentCollected({
        orderId: "order-cancelled",
        actorId: "admin-1",
      }),
    ).rejects.toThrow(
      "No se puede cobrar un pedido cancelado, expirado o fallido.",
    );

    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.orderStatusHistory.create).not.toHaveBeenCalled();
  });

  it("removes an item from a paid order and creates one partial Stripe refund", async () => {
    const paidOrder = {
      id: "order-1",
      orderNumber: "MT-0001",
      status: OrderStatus.PAID,
      currency: "eur",
      deliveryFeeCents: 0,
      discountCents: 0,
      taxRate: 0.1,
      items: [
        {
          id: "item-remove",
          productName: "Mordida Smash",
          lineTotalCents: 1190,
          removedAt: null,
        },
        {
          id: "item-keep",
          productName: "Patatas",
          lineTotalCents: 390,
          removedAt: null,
        },
      ],
      payments: [
        {
          id: "payment-1",
          status: PaymentStatus.SUCCEEDED,
          amountCents: 1580,
          stripePaymentIntentId: "pi_paid",
        },
      ],
    };
    const summary = { id: "order-1", items: [], statusHistory: [] };
    prisma.order.findUnique.mockResolvedValue(paidOrder);
    prisma.order.findUniqueOrThrow.mockResolvedValue(summary);
    prisma.paymentRefund.aggregate.mockResolvedValue({
      _sum: { amountCents: 1190 },
    });

    await expect(
      service().removeOrderItemWithRefund({
        orderId: "order-1",
        itemId: "item-remove",
        reason: "Sin stock",
        actorId: "admin-1",
      }),
    ).resolves.toEqual({
      order: summary,
      refundedCents: 1190,
      stripeRefundId: "re_123",
    });

    expect(stripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent: "pi_paid",
        amount: 1190,
        metadata: expect.objectContaining({
          orderItemId: "item-remove",
          removedReason: "Sin stock",
        }),
      }),
      { idempotencyKey: "order-item-remove:item-remove" },
    );
    expect(prisma.orderItem.update).toHaveBeenCalledWith({
      where: { id: "item-remove" },
      data: expect.objectContaining({
        removedReason: "Sin stock",
        refundedCents: 1190,
        stripeRefundId: "re_123",
      }),
    });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({
        subtotalCents: 390,
        totalCents: 390,
      }),
    });
  });

  it("does not create another Stripe refund for an already removed item", async () => {
    const removedAt = new Date();
    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      status: OrderStatus.PAID,
      items: [
        {
          id: "item-remove",
          productName: "Mordida Smash",
          lineTotalCents: 1190,
          removedAt,
          refundedCents: 1190,
          stripeRefundId: "re_existing",
        },
      ],
      payments: [],
    });
    prisma.order.findUniqueOrThrow.mockResolvedValue({
      id: "order-1",
      items: [],
      statusHistory: [],
    });

    await expect(
      service().removeOrderItemWithRefund({
        orderId: "order-1",
        itemId: "item-remove",
        reason: "Sin stock",
        actorId: "admin-1",
      }),
    ).resolves.toMatchObject({
      refundedCents: 1190,
      stripeRefundId: "re_existing",
    });

    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it("cancels a paid order with one full Stripe refund", async () => {
    const paidOrder = {
      id: "order-1",
      orderNumber: "MT-0001",
      status: OrderStatus.PAID,
      currency: "eur",
      stripePaymentIntentId: null,
      items: [],
      refunds: [],
      payments: [
        {
          id: "payment-1",
          status: PaymentStatus.SUCCEEDED,
          amountCents: 1440,
          stripePaymentIntentId: "pi_paid",
        },
      ],
    };
    const summary = {
      id: "order-1",
      status: OrderStatus.CANCELLED,
      totalCents: 0,
      items: [],
      statusHistory: [],
    };
    prisma.order.findUnique.mockResolvedValue(paidOrder);
    prisma.order.findUniqueOrThrow.mockResolvedValue(summary);
    prisma.paymentRefund.aggregate.mockResolvedValue({
      _sum: { amountCents: 1440 },
    });
    stripe.refunds.create.mockResolvedValue({ id: "re_full" });

    await expect(
      service().cancelPaidOrderWithRefund({
        orderId: "order-1",
        reason: "Cliente solicita cancelacion",
        actorId: "admin-1",
      }),
    ).resolves.toEqual({
      order: summary,
      refundedCents: 1440,
      stripeRefundId: "re_full",
    });

    expect(stripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent: "pi_paid",
        amount: 1440,
        metadata: expect.objectContaining({
          orderId: "order-1",
          cancelReason: "Cliente solicita cancelacion",
        }),
      }),
      { idempotencyKey: "order-cancel:order-1" },
    );
    expect(prisma.paymentRefund.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeRefundId: "re_full" },
        create: expect.objectContaining({
          orderId: "order-1",
          paymentId: "payment-1",
          amountCents: 1440,
          stripePaymentIntentId: "pi_paid",
          reason: "Cliente solicita cancelacion",
        }),
      }),
    );
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: "payment-1" },
      data: { status: PaymentStatus.REFUNDED },
    });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: {
        status: OrderStatus.CANCELLED,
        subtotalCents: 0,
        deliveryFeeCents: 0,
        taxCents: 0,
        totalCents: 0,
      },
    });
    expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: "order-1",
        fromStatus: OrderStatus.PAID,
        toStatus: OrderStatus.CANCELLED,
        changedById: "admin-1",
      }),
    });
  });

  it("subtracts previous partial refunds before cancelling a paid order", async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      orderNumber: "MT-0001",
      status: OrderStatus.CONFIRMED,
      currency: "eur",
      stripePaymentIntentId: "pi_paid",
      items: [],
      refunds: [
        {
          id: "refund-partial",
          orderItemId: "item-1",
          amountCents: 390,
          stripeRefundId: "re_partial",
        },
      ],
      payments: [
        {
          id: "payment-1",
          status: PaymentStatus.SUCCEEDED,
          amountCents: 1580,
          stripePaymentIntentId: "pi_paid",
        },
      ],
    });
    prisma.order.findUniqueOrThrow.mockResolvedValue({
      id: "order-1",
      status: OrderStatus.CANCELLED,
      items: [],
      statusHistory: [],
    });
    prisma.paymentRefund.aggregate.mockResolvedValue({
      _sum: { amountCents: 1580 },
    });

    await service().cancelPaidOrderWithRefund({
      orderId: "order-1",
      reason: "Cancelacion tras ajuste",
      actorId: "admin-1",
    });

    expect(stripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1190,
      }),
      { idempotencyKey: "order-cancel:order-1" },
    );
  });

  it("does not create another Stripe refund when full cancellation is retried", async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      status: OrderStatus.CANCELLED,
      refunds: [
        {
          id: "refund-full",
          orderItemId: null,
          amountCents: 1440,
          stripeRefundId: "re_full",
        },
      ],
      payments: [],
    });
    prisma.order.findUniqueOrThrow.mockResolvedValue({
      id: "order-1",
      status: OrderStatus.CANCELLED,
      items: [],
      statusHistory: [],
    });

    await expect(
      service().cancelPaidOrderWithRefund({
        orderId: "order-1",
        reason: "Cliente solicita cancelacion",
        actorId: "admin-1",
      }),
    ).resolves.toMatchObject({
      refundedCents: 1440,
      stripeRefundId: "re_full",
    });

    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it("rejects full cancellation when the order has no succeeded Stripe payment", async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      orderNumber: "MT-0001",
      status: OrderStatus.PAID,
      currency: "eur",
      stripePaymentIntentId: null,
      refunds: [],
      items: [],
      payments: [],
    });

    await expect(
      service().cancelPaidOrderWithRefund({
        orderId: "order-1",
        reason: "Cliente solicita cancelacion",
        actorId: "admin-1",
      }),
    ).rejects.toThrow("Este pedido no tiene un pago real de Stripe asociado.");

    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it("rejects delivered orders from the full cancellation flow", async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      orderNumber: "MT-0001",
      status: OrderStatus.DELIVERED,
      currency: "eur",
      stripePaymentIntentId: "pi_paid",
      refunds: [],
      items: [],
      payments: [
        {
          id: "payment-1",
          status: PaymentStatus.SUCCEEDED,
          amountCents: 1440,
          stripePaymentIntentId: "pi_paid",
        },
      ],
    });

    await expect(
      service().cancelPaidOrderWithRefund({
        orderId: "order-1",
        reason: "Cliente solicita cancelacion",
        actorId: "admin-1",
      }),
    ).rejects.toThrow(
      "Solo se pueden cancelar con reembolso pedidos pagados y no entregados.",
    );

    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });
});

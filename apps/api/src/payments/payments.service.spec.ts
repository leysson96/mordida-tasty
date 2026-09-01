import { BadRequestException } from "@nestjs/common";
import { OrderPaymentMethod, OrderStatus, PaymentStatus } from "@prisma/client";
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
    $transaction: jest.fn(),
  };

  const ordersService = {
    getForCheckout: jest.fn(),
    transitionOrder: jest.fn(),
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
    refunds: {
      create: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  };

  const configValues: Record<string, string | undefined> = {
    STRIPE_WEBHOOK_SECRET: "whsec_test",
    FRONTEND_URL: "https://mordida.test",
    STRIPE_SUCCESS_PATH: "/seguimiento/{ORDER_NUMBER}?t={TRACKING_TOKEN}",
    STRIPE_CANCEL_PATH: "/carrito",
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
    prisma.orderItem.update.mockResolvedValue({});
    prisma.orderStatusHistory.create.mockResolvedValue({});
    prisma.paymentRefund.upsert.mockResolvedValue({});
    prisma.paymentRefund.aggregate.mockResolvedValue({
      _sum: { amountCents: 0 },
    });
    stripe.refunds.create.mockResolvedValue({ id: "re_123" });
  });

  function service() {
    const paymentsService = new PaymentsService(
      prisma as never,
      ordersService as never,
      mailService as never,
      config as never,
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

  it("moves a pending order to paid when Stripe confirms checkout", async () => {
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

    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: "pi_failed" },
      data: { status: PaymentStatus.FAILED },
    });
    expect(ordersService.transitionOrder).toHaveBeenCalledWith(
      "order-1",
      OrderStatus.PAYMENT_FAILED,
      undefined,
      "Stripe payment failed: pi_failed",
    );
  });

  it("creates checkout sessions with Stripe idempotency tied to the order", async () => {
    ordersService.getForCheckout.mockResolvedValue({
      id: "order-1",
      orderNumber: "MT-0001",
      trackingToken: "track_123",
      status: OrderStatus.CREATED,
      customerEmail: "cliente@example.com",
      currency: "eur",
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
      service().createCheckoutSession({ orderId: "order-1" }),
    ).resolves.toEqual({
      orderNumber: "MT-0001",
      checkoutUrl: "https://stripe.test/checkout",
    });

    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        client_reference_id: "order-1",
        success_url: "https://mordida.test/seguimiento/MT-0001?t=track_123",
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

  it("rejects checkout when all order items were removed", async () => {
    ordersService.getForCheckout.mockResolvedValue({
      id: "order-1",
      status: OrderStatus.CREATED,
      items: [{ removedAt: new Date() }],
    });

    await expect(
      service().createCheckoutSession({ orderId: "order-1" }),
    ).rejects.toThrow(BadRequestException);

    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("rejects Stripe checkout for cash orders", async () => {
    ordersService.getForCheckout.mockResolvedValue({
      id: "order-1",
      status: OrderStatus.CREATED,
      paymentMethod: OrderPaymentMethod.CASH,
      items: [{ removedAt: null }],
    });

    await expect(
      service().createCheckoutSession({ orderId: "order-1" }),
    ).rejects.toThrow("Este pedido se pagara en efectivo");

    expect(ordersService.transitionOrder).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
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

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { Request } from "express";
import Stripe from "stripe";
import { AppEnv } from "../config/env";
import {
  paidOrBeyondStatuses,
  removableOrderItemStatuses,
} from "../orders/order-state";
import { OrdersService } from "../orders/orders.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCheckoutSessionDto } from "./dto/create-checkout-session.dto";

const doNotFulfillAfterPaymentStatuses: OrderStatus[] = [
  OrderStatus.CANCELLED,
  OrderStatus.EXPIRED,
];

const orderSummaryInclude = {
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      options: {
        orderBy: { createdAt: "asc" },
      },
    },
  },
  statusHistory: {
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.OrderInclude;

const orderWithPaymentsInclude = {
  items: true,
  payments: true,
} satisfies Prisma.OrderInclude;

const orderWithPaymentsAndRefundsInclude = {
  items: true,
  payments: true,
  refunds: true,
} satisfies Prisma.OrderInclude;

const fullyRefundableOrderStatuses: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
];

@Injectable()
export class PaymentsService {
  private readonly stripe?: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly configService: ConfigService<AppEnv, true>,
  ) {
    const secretKey = this.configService.get("STRIPE_SECRET_KEY", {
      infer: true,
    });
    if (secretKey) {
      this.stripe = new Stripe(secretKey);
    }
  }

  async createCheckoutSession(dto: CreateCheckoutSessionDto) {
    const stripe = this.requireStripe();
    const order = await this.ordersService.getForCheckout(dto.orderId);
    const payableItems = order.items.filter((item) => !item.removedAt);

    if (paidOrBeyondStatuses.includes(order.status)) {
      throw new BadRequestException("Order is already paid.");
    }

    if (payableItems.length === 0) {
      throw new BadRequestException("El pedido no tiene productos activos.");
    }

    await this.ordersService.transitionOrder(
      order.id,
      OrderStatus.PENDING_PAYMENT,
      undefined,
      "Checkout session requested",
    );

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        client_reference_id: order.id,
        customer_email: order.customerEmail,
        success_url: this.stripeSuccessUrl(order),
        cancel_url: this.frontendUrl(
          this.configService.get("STRIPE_CANCEL_PATH", { infer: true }),
        ),
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
        },
        line_items: [
          ...payableItems.map((item) => ({
            quantity: item.quantity,
            price_data: {
              currency: order.currency,
              unit_amount: item.unitPriceCents,
              product_data: {
                name: this.stripeLineItemName(item),
              },
            },
          })),
          ...(order.deliveryFeeCents > 0
            ? [
                {
                  quantity: 1,
                  price_data: {
                    currency: order.currency,
                    unit_amount: order.deliveryFeeCents,
                    product_data: {
                      name: "Envio",
                    },
                  },
                },
              ]
            : []),
        ],
      },
      {
        idempotencyKey: `checkout:${order.id}`,
      },
    );

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: order.id },
        data: {
          stripeSessionId: session.id,
          stripePaymentIntentId: this.stringId(session.payment_intent),
          expiresAt: session.expires_at
            ? new Date(session.expires_at * 1000)
            : undefined,
        },
      }),
      this.prisma.payment.upsert({
        where: { stripeSessionId: session.id },
        update: {
          status: PaymentStatus.PENDING,
          stripePaymentIntentId: this.stringId(session.payment_intent),
        },
        create: {
          orderId: order.id,
          status: PaymentStatus.PENDING,
          amountCents: order.totalCents,
          currency: order.currency,
          stripeSessionId: session.id,
          stripePaymentIntentId: this.stringId(session.payment_intent),
        },
      }),
    ]);

    return {
      orderNumber: order.orderNumber,
      checkoutUrl: session.url,
    };
  }

  async removeOrderItemWithRefund(input: {
    orderId: string;
    itemId: string;
    reason: string;
    actorId: string;
  }) {
    const reason = input.reason.trim();
    const order = await this.prisma.order.findUnique({
      where: { id: input.orderId },
      include: orderWithPaymentsInclude,
    });

    if (!order) {
      throw new NotFoundException("Order not found.");
    }

    if (!removableOrderItemStatuses.includes(order.status)) {
      throw new BadRequestException(
        "Solo se pueden quitar productos de pedidos ya pagados.",
      );
    }

    const item = order.items.find((orderItem) => orderItem.id === input.itemId);
    if (!item) {
      throw new NotFoundException("Order item not found.");
    }

    if (item.removedAt) {
      return {
        order: await this.getOrderSummary(order.id),
        refundedCents: item.refundedCents,
        stripeRefundId: item.stripeRefundId,
      };
    }

    const activeItems = order.items.filter((orderItem) => !orderItem.removedAt);
    if (activeItems.length <= 1) {
      throw new BadRequestException(
        "No se puede quitar el ultimo producto. Cancela el pedido completo y reembolsa desde Stripe.",
      );
    }

    if (item.lineTotalCents <= 0) {
      throw new BadRequestException(
        "El producto no tiene importe reembolsable.",
      );
    }

    const payment = this.findSucceededPayment(order.payments);
    const paymentIntentId =
      order.stripePaymentIntentId ?? payment?.stripePaymentIntentId;

    if (!paymentIntentId) {
      throw new BadRequestException(
        "Este pedido no tiene un pago real de Stripe asociado.",
      );
    }

    const stripe = this.requireStripe();
    const refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        amount: item.lineTotalCents,
        reason: "requested_by_customer",
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          orderItemId: item.id,
          productName: item.productName,
          removedReason: reason,
        },
      },
      {
        idempotencyKey: `order-item-remove:${item.id}`,
      },
    );

    const updated = await this.prisma.$transaction(
      async (tx) => {
        const currentOrder = await tx.order.findUnique({
          where: { id: input.orderId },
          include: orderWithPaymentsInclude,
        });

        if (!currentOrder) {
          throw new NotFoundException("Order not found.");
        }

        const currentItem = currentOrder.items.find(
          (orderItem) => orderItem.id === input.itemId,
        );
        if (!currentItem) {
          throw new NotFoundException("Order item not found.");
        }

        if (currentItem.removedAt) {
          return {
            order: await tx.order.findUniqueOrThrow({
              where: { id: currentOrder.id },
              include: orderSummaryInclude,
            }),
            refundedCents: currentItem.refundedCents,
            stripeRefundId: currentItem.stripeRefundId,
          };
        }

        const remainingItems = currentOrder.items.filter(
          (orderItem) =>
            !orderItem.removedAt && orderItem.id !== currentItem.id,
        );

        if (remainingItems.length === 0) {
          throw new BadRequestException(
            "No se puede quitar el ultimo producto. Cancela el pedido completo y reembolsa desde Stripe.",
          );
        }

        const matchingPayment = this.findSucceededPayment(
          currentOrder.payments,
        );
        const subtotalCents = remainingItems.reduce(
          (sum, orderItem) => sum + orderItem.lineTotalCents,
          0,
        );
        const totalCents = Math.max(
          0,
          subtotalCents +
            currentOrder.deliveryFeeCents -
            currentOrder.discountCents,
        );
        const taxCents = this.includedTaxCents(
          totalCents,
          Number(currentOrder.taxRate),
        );

        await tx.orderItem.update({
          where: { id: currentItem.id },
          data: {
            removedAt: new Date(),
            removedReason: reason,
            removedById: input.actorId,
            refundedCents: currentItem.lineTotalCents,
            stripeRefundId: refund.id,
          },
        });

        await tx.paymentRefund.upsert({
          where: { stripeRefundId: refund.id },
          update: {
            amountCents: currentItem.lineTotalCents,
            reason,
          },
          create: {
            orderId: currentOrder.id,
            orderItemId: currentItem.id,
            paymentId: matchingPayment?.id,
            amountCents: currentItem.lineTotalCents,
            currency: currentOrder.currency,
            stripeRefundId: refund.id,
            stripePaymentIntentId: paymentIntentId,
            reason,
          },
        });

        const refunded = await tx.paymentRefund.aggregate({
          where: { orderId: currentOrder.id },
          _sum: { amountCents: true },
        });

        if (
          matchingPayment &&
          (refunded._sum.amountCents ?? 0) >= matchingPayment.amountCents
        ) {
          await tx.payment.update({
            where: { id: matchingPayment.id },
            data: { status: PaymentStatus.REFUNDED },
          });
        }

        await tx.order.update({
          where: { id: currentOrder.id },
          data: {
            subtotalCents,
            totalCents,
            taxCents,
          },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: currentOrder.id,
            fromStatus: currentOrder.status,
            toStatus: currentOrder.status,
            changedById: input.actorId,
            note: `Producto quitado: ${currentItem.productName}. Reembolso parcial ${currentItem.lineTotalCents} centimos.`,
          },
        });

        return {
          order: await tx.order.findUniqueOrThrow({
            where: { id: currentOrder.id },
            include: orderSummaryInclude,
          }),
          refundedCents: currentItem.lineTotalCents,
          stripeRefundId: refund.id,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return updated;
  }

  async cancelPaidOrderWithRefund(input: {
    orderId: string;
    reason: string;
    actorId: string;
  }) {
    const reason = input.reason.trim();
    const order = await this.prisma.order.findUnique({
      where: { id: input.orderId },
      include: orderWithPaymentsAndRefundsInclude,
    });

    if (!order) {
      throw new NotFoundException("Order not found.");
    }

    const existingFullRefund = order.refunds.find(
      (refund) => !refund.orderItemId,
    );
    if (existingFullRefund && order.status === OrderStatus.CANCELLED) {
      return {
        order: await this.getOrderSummary(order.id),
        refundedCents: existingFullRefund.amountCents,
        stripeRefundId: existingFullRefund.stripeRefundId,
      };
    }

    if (!fullyRefundableOrderStatuses.includes(order.status)) {
      throw new BadRequestException(
        "Solo se pueden cancelar con reembolso pedidos pagados y no entregados.",
      );
    }

    const payment = this.findSucceededPayment(order.payments);
    const paymentIntentId =
      order.stripePaymentIntentId ?? payment?.stripePaymentIntentId;

    if (!payment || !paymentIntentId) {
      throw new BadRequestException(
        "Este pedido no tiene un pago real de Stripe asociado.",
      );
    }

    const refundedAlreadyCents = order.refunds.reduce(
      (sum, refund) => sum + refund.amountCents,
      0,
    );
    const refundableCents = payment.amountCents - refundedAlreadyCents;

    if (refundableCents <= 0) {
      throw new BadRequestException(
        "Este pedido no tiene importe pendiente de reembolso.",
      );
    }

    const stripe = this.requireStripe();
    const refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        amount: refundableCents,
        reason: "requested_by_customer",
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          cancelReason: reason,
        },
      },
      {
        idempotencyKey: `order-cancel:${order.id}`,
      },
    );

    const updated = await this.prisma.$transaction(
      async (tx) => {
        const currentOrder = await tx.order.findUnique({
          where: { id: input.orderId },
          include: orderWithPaymentsAndRefundsInclude,
        });

        if (!currentOrder) {
          throw new NotFoundException("Order not found.");
        }

        const currentFullRefund = currentOrder.refunds.find(
          (item) => !item.orderItemId,
        );
        if (
          currentFullRefund &&
          currentOrder.status === OrderStatus.CANCELLED
        ) {
          return {
            order: await tx.order.findUniqueOrThrow({
              where: { id: currentOrder.id },
              include: orderSummaryInclude,
            }),
            refundedCents: currentFullRefund.amountCents,
            stripeRefundId: currentFullRefund.stripeRefundId,
          };
        }

        if (!fullyRefundableOrderStatuses.includes(currentOrder.status)) {
          throw new BadRequestException(
            "Solo se pueden cancelar con reembolso pedidos pagados y no entregados.",
          );
        }

        const matchingPayment = this.findSucceededPayment(
          currentOrder.payments,
        );
        if (!matchingPayment) {
          throw new BadRequestException(
            "Este pedido no tiene un pago real de Stripe asociado.",
          );
        }

        await tx.paymentRefund.upsert({
          where: { stripeRefundId: refund.id },
          update: {
            amountCents: refundableCents,
            reason,
          },
          create: {
            orderId: currentOrder.id,
            paymentId: matchingPayment.id,
            amountCents: refundableCents,
            currency: currentOrder.currency,
            stripeRefundId: refund.id,
            stripePaymentIntentId: paymentIntentId,
            reason,
          },
        });

        const refunded = await tx.paymentRefund.aggregate({
          where: { orderId: currentOrder.id },
          _sum: { amountCents: true },
        });

        if ((refunded._sum.amountCents ?? 0) >= matchingPayment.amountCents) {
          await tx.payment.update({
            where: { id: matchingPayment.id },
            data: { status: PaymentStatus.REFUNDED },
          });
        }

        await tx.order.update({
          where: { id: currentOrder.id },
          data: {
            status: OrderStatus.CANCELLED,
            subtotalCents: 0,
            deliveryFeeCents: 0,
            taxCents: 0,
            totalCents: 0,
          },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: currentOrder.id,
            fromStatus: currentOrder.status,
            toStatus: OrderStatus.CANCELLED,
            changedById: input.actorId,
            note: `Pedido cancelado con reembolso ${refundableCents} centimos. Motivo: ${reason}`,
          },
        });

        return {
          order: await tx.order.findUniqueOrThrow({
            where: { id: currentOrder.id },
            include: orderSummaryInclude,
          }),
          refundedCents: refundableCents,
          stripeRefundId: refund.id,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return updated;
  }

  async handleWebhook(request: Request & { rawBody?: Buffer }) {
    const stripe = this.requireStripe();
    const webhookSecret = this.configService.get("STRIPE_WEBHOOK_SECRET", {
      infer: true,
    });
    const signature = request.headers["stripe-signature"];

    if (!webhookSecret) {
      throw new InternalServerErrorException(
        "Stripe webhook secret is not configured.",
      );
    }

    if (!request.rawBody || !signature) {
      throw new BadRequestException(
        "Missing Stripe webhook signature or raw body.",
      );
    }

    const event = stripe.webhooks.constructEvent(
      request.rawBody,
      Array.isArray(signature) ? signature[0] : signature,
      webhookSecret,
    );

    const storedEvent = await this.prisma.stripeEvent.findUnique({
      where: { id: event.id },
    });
    if (storedEvent?.processedAt) {
      return { received: true, duplicate: true };
    }

    if (!storedEvent) {
      await this.prisma.stripeEvent.create({
        data: {
          id: event.id,
          type: event.type,
        },
      });
    }

    await this.processEvent(event);
    await this.prisma.stripeEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() },
    });

    return { received: true };
  }

  private async processEvent(event: Stripe.Event) {
    switch (event.type) {
      case "checkout.session.completed":
        await this.handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        return;
      case "checkout.session.expired":
        await this.handleCheckoutExpired(
          event.data.object as Stripe.Checkout.Session,
        );
        return;
      case "payment_intent.payment_failed":
        await this.handlePaymentFailed(
          event.data.object as Stripe.PaymentIntent,
        );
        return;
      default:
        return;
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const order = await this.findOrderFromSession(session);
    const paymentIntentId = this.stringId(session.payment_intent);

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: order.id },
        data: {
          stripeSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
        },
      }),
      this.prisma.payment.upsert({
        where: { stripeSessionId: session.id },
        update: {
          status: PaymentStatus.SUCCEEDED,
          stripePaymentIntentId: paymentIntentId,
        },
        create: {
          orderId: order.id,
          status: PaymentStatus.SUCCEEDED,
          amountCents: order.totalCents,
          currency: order.currency,
          stripeSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
        },
      }),
    ]);

    if (doNotFulfillAfterPaymentStatuses.includes(order.status)) {
      await this.prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: order.status,
          note: `Pago recibido despues de ${order.status}. Revisar reembolso manual en Stripe: ${session.id}`,
        },
      });
      return;
    }

    if (!paidOrBeyondStatuses.includes(order.status)) {
      await this.ordersService.transitionOrder(
        order.id,
        OrderStatus.PAID,
        undefined,
        `Stripe checkout completed: ${session.id}`,
      );
    }
  }

  private async handleCheckoutExpired(session: Stripe.Checkout.Session) {
    const order = await this.findOrderFromSession(session);

    await this.prisma.payment.updateMany({
      where: { stripeSessionId: session.id },
      data: { status: PaymentStatus.EXPIRED },
    });

    if (!paidOrBeyondStatuses.includes(order.status)) {
      await this.ordersService.transitionOrder(
        order.id,
        OrderStatus.EXPIRED,
        undefined,
        `Stripe checkout expired: ${session.id}`,
      );
    }
  }

  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
    const order = await this.prisma.order.findFirst({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (!order) {
      return;
    }

    await this.prisma.payment.updateMany({
      where: { stripePaymentIntentId: paymentIntent.id },
      data: { status: PaymentStatus.FAILED },
    });

    if (!paidOrBeyondStatuses.includes(order.status)) {
      await this.ordersService.transitionOrder(
        order.id,
        OrderStatus.PAYMENT_FAILED,
        undefined,
        `Stripe payment failed: ${paymentIntent.id}`,
      );
    }
  }

  private async findOrderFromSession(session: Stripe.Checkout.Session) {
    const orderId =
      session.metadata?.orderId ?? session.client_reference_id ?? undefined;
    const order = orderId
      ? await this.prisma.order.findUnique({ where: { id: orderId } })
      : await this.prisma.order.findUnique({
          where: { stripeSessionId: session.id },
        });

    if (!order) {
      throw new NotFoundException(
        `Order not found for Stripe session ${session.id}.`,
      );
    }

    return order;
  }

  private requireStripe() {
    if (!this.stripe) {
      throw new InternalServerErrorException("Stripe no esta configurado.");
    }
    return this.stripe;
  }

  private frontendUrl(path: string) {
    return new URL(
      path,
      this.configService.get("FRONTEND_URL", { infer: true }),
    ).toString();
  }

  private stripeSuccessUrl(order: {
    orderNumber: string;
    trackingToken: string;
  }) {
    const path = this.configService
      .get("STRIPE_SUCCESS_PATH", { infer: true })
      .replace("{ORDER_NUMBER}", encodeURIComponent(order.orderNumber))
      .replace("{TRACKING_TOKEN}", encodeURIComponent(order.trackingToken));

    return this.frontendUrl(path);
  }

  private stringId(value: string | Stripe.PaymentIntent | null) {
    if (!value) {
      return undefined;
    }
    return typeof value === "string" ? value : value.id;
  }

  private stripeLineItemName(item: {
    productName: string;
    options?: Array<{ groupName: string; choiceName: string }>;
  }) {
    const optionText = item.options
      ?.map((option) => `${option.groupName}: ${option.choiceName}`)
      .join(", ");

    return optionText
      ? `${item.productName} (${optionText})`
      : item.productName;
  }

  private findSucceededPayment<
    T extends { status: PaymentStatus; stripePaymentIntentId: string | null },
  >(payments: T[]) {
    return payments.find(
      (payment) =>
        payment.status === PaymentStatus.SUCCEEDED &&
        payment.stripePaymentIntentId,
    );
  }

  private async getOrderSummary(orderId: string) {
    return this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: orderSummaryInclude,
    });
  }

  private includedTaxCents(totalCents: number, taxRate: number) {
    if (taxRate <= 0) {
      return 0;
    }
    return Math.round(totalCents - totalCents / (1 + taxRate));
  }
}

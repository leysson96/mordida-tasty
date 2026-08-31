import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DeliveryMethod, OrderStatus, Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { AppEnv } from "../config/env";
import { LEGAL_VERSION } from "../legal/legal-version";
import { DeliveryZonesService } from "../settings/delivery-zones.service";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import {
  activeKitchenStatuses,
  assertOrderTransition,
  revenueOrderStatuses,
} from "./order-state";

const orderInclude = {
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

const checkoutProductInclude = {
  optionGroups: {
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      choices: {
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  },
} satisfies Prisma.ProductInclude;

type CheckoutProduct = Prisma.ProductGetPayload<{
  include: typeof checkoutProductInclude;
}>;

interface AdminOrderListOptions {
  status?: OrderStatus;
  today?: boolean;
  q?: string;
  from?: string;
  to?: string;
  deliveryMethod?: DeliveryMethod;
  page?: string;
  pageSize?: string;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly deliveryZonesService: DeliveryZonesService,
    private readonly configService: ConfigService<AppEnv, true>,
  ) {}

  async createOrder(
    dto: CreateOrderDto,
    idempotencyKey: string | undefined,
    user?: AuthenticatedUser,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException("Idempotency-Key header is required.");
    }

    const existing = await this.prisma.order.findUnique({
      where: { idempotencyKey },
      include: orderInclude,
    });

    if (existing) {
      return existing;
    }

    const serviceStatus = await this.settingsService.getServiceStatus();
    if (!serviceStatus.openNow) {
      throw new BadRequestException(
        serviceStatus.reason ?? "Los pedidos estan cerrados ahora mismo.",
      );
    }

    if (dto.deliveryMethod === DeliveryMethod.DELIVERY && !dto.address) {
      throw new BadRequestException("La direccion de entrega es obligatoria.");
    }

    const productIds = [...new Set(dto.items.map((item) => item.productId))];
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        active: true,
        category: {
          active: true,
        },
      },
      include: checkoutProductInclude,
    });
    const productMap = new Map(
      products.map((product) => [product.id, product]),
    );

    for (const item of dto.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new BadRequestException(`Product not found: ${item.productId}`);
      }
      if (!product.available) {
        throw new BadRequestException(
          `Product is not available: ${product.name}`,
        );
      }
    }

    const orderLines = dto.items.map((item) => {
      const product = productMap.get(item.productId)!;
      return this.buildOrderLine(item, product);
    });

    const subtotalCents = orderLines.reduce(
      (sum, item) => sum + item.lineTotalCents,
      0,
    );
    let deliveryFeeCents = 0;
    if (dto.deliveryMethod === DeliveryMethod.DELIVERY) {
      const deliveryQuote = await this.deliveryZonesService.quoteDelivery(
        dto.address?.postalCode,
        subtotalCents,
      );

      if (!deliveryQuote.available) {
        throw new BadRequestException(
          deliveryQuote.reason ?? "No se pudo confirmar el reparto.",
        );
      }

      deliveryFeeCents = deliveryQuote.deliveryFeeCents;
    }

    const discountCents = 0;
    const totalCents = subtotalCents + deliveryFeeCents - discountCents;
    const taxRate = await this.settingsService.getTaxRate();
    const taxCents = this.includedTaxCents(totalCents, taxRate);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const orderNumber = await this.nextOrderNumber(tx);
        const order = await tx.order.create({
          data: {
            orderNumber,
            trackingToken: this.trackingToken(),
            userId: user?.id,
            customerEmail: dto.customerEmail.toLowerCase().trim(),
            customerName: dto.customerName.trim(),
            customerPhone: dto.customerPhone.trim(),
            deliveryMethod: dto.deliveryMethod,
            deliveryName: dto.address?.name.trim(),
            deliveryPhone: dto.address?.phone.trim(),
            deliveryStreet: dto.address?.street.trim(),
            deliveryCity: dto.address?.city.trim(),
            deliveryPostalCode: dto.address?.postalCode.trim(),
            deliveryNotes: dto.address?.notes?.trim(),
            subtotalCents,
            discountCents,
            deliveryFeeCents,
            taxCents,
            totalCents,
            taxRate,
            idempotencyKey,
            acceptedLegalAt: new Date(),
            legalVersion: LEGAL_VERSION,
            items: {
              create: orderLines.map((line) => ({
                productId: line.productId,
                productName: line.productName,
                unitPriceCents: line.unitPriceCents,
                quantity: line.quantity,
                lineTotalCents: line.lineTotalCents,
                options:
                  line.options.length > 0
                    ? { create: line.options }
                    : undefined,
              })),
            },
            statusHistory: {
              create: {
                toStatus: OrderStatus.CREATED,
                changedById: user?.id,
                note: "Order created",
              },
            },
          },
          include: orderInclude,
        });

        return order;
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        return this.prisma.order.findUniqueOrThrow({
          where: { idempotencyKey },
          include: orderInclude,
        });
      }
      throw error;
    }
  }

  async getPublicTracking(
    orderNumber: string,
    trackingToken: string | undefined,
  ) {
    if (!trackingToken) {
      throw new BadRequestException("El enlace de seguimiento no es valido.");
    }

    const order = await this.prisma.order.findUnique({
      where: { trackingToken },
      include: orderInclude,
    });

    if (!order || order.orderNumber !== orderNumber) {
      throw new NotFoundException("Order not found.");
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      deliveryMethod: order.deliveryMethod,
      customerName: order.customerName,
      totalCents: order.totalCents,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items
        .filter((item) => !item.removedAt)
        .map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          lineTotalCents: item.lineTotalCents,
          options: item.options.map((option) => ({
            groupName: option.groupName,
            choiceName: option.choiceName,
            priceCents: option.priceCents,
          })),
        })),
      statusHistory: order.statusHistory.map((item) => ({
        toStatus: item.toStatus,
        note: item.note,
        createdAt: item.createdAt,
      })),
    };
  }

  async listMine(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: orderInclude,
    });
  }

  async getForCheckout(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });

    if (!order) {
      throw new NotFoundException("Order not found.");
    }

    return order;
  }

  async listAdminOrders(options: AdminOrderListOptions) {
    const where: Prisma.OrderWhereInput = {};
    const status = this.parseOrderStatus(options.status);
    const deliveryMethod = this.parseDeliveryMethod(options.deliveryMethod);

    if (status) {
      where.status = status;
    }

    if (deliveryMethod) {
      where.deliveryMethod = deliveryMethod;
    }

    if (options.from || options.to) {
      const range = this.dateRange(options.from, options.to);
      where.createdAt = { gte: range.fromDate, lt: range.toExclusiveDate };
    } else if (options.today) {
      const range = this.currentBusinessDayRange();
      where.createdAt = { gte: range.fromDate, lt: range.toExclusiveDate };
    }

    const q = options.q?.trim();
    if (q) {
      where.OR = [
        { orderNumber: { contains: q, mode: "insensitive" } },
        { customerEmail: { contains: q, mode: "insensitive" } },
        { customerName: { contains: q, mode: "insensitive" } },
        { customerPhone: { contains: q } },
        { deliveryName: { contains: q, mode: "insensitive" } },
        { deliveryPhone: { contains: q } },
        { deliveryPostalCode: { contains: q, mode: "insensitive" } },
      ];
    }

    const query: Prisma.OrderFindManyArgs = {
      where,
      orderBy: { createdAt: "desc" },
      include: orderInclude,
    };
    const pagination = this.adminOrderPagination(
      options.page,
      options.pageSize,
    );
    if (pagination) {
      query.skip = pagination.skip;
      query.take = pagination.take;
    }

    return this.prisma.order.findMany(query);
  }

  async listKitchenOrders() {
    return this.prisma.order.findMany({
      where: {
        status: {
          in: activeKitchenStatuses,
        },
      },
      orderBy: { createdAt: "asc" },
      include: orderInclude,
    });
  }

  async dashboardToday() {
    const range = this.currentBusinessDayRange();

    const [orders, revenue] = await Promise.all([
      this.prisma.order.groupBy({
        by: ["status"],
        where: {
          createdAt: { gte: range.fromDate, lt: range.toExclusiveDate },
        },
        _count: { _all: true },
      }),
      this.prisma.order.aggregate({
        where: {
          createdAt: { gte: range.fromDate, lt: range.toExclusiveDate },
          status: {
            in: revenueOrderStatuses,
          },
        },
        _sum: { totalCents: true },
      }),
    ]);

    return {
      date: range.date,
      paidRevenueCents: revenue._sum.totalCents ?? 0,
      ordersByStatus: orders.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = item._count._all;
        return acc;
      }, {}),
    };
  }

  async salesReport(options: { from?: string; to?: string }) {
    const range = this.dateRange(options.from, options.to);
    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: {
          gte: range.fromDate,
          lt: range.toExclusiveDate,
        },
        status: {
          in: revenueOrderStatuses,
        },
      },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const totalRevenueCents = orders.reduce(
      (sum, order) => sum + order.totalCents,
      0,
    );
    const orderCount = orders.length;
    const salesByDay = this.daysBetween(range.from, range.to).map((date) => ({
      date,
      revenueCents: 0,
      orderCount: 0,
    }));
    const salesByDayMap = new Map(salesByDay.map((day) => [day.date, day]));
    const productMap = new Map<
      string,
      { productName: string; quantity: number; revenueCents: number }
    >();

    for (const order of orders) {
      const dayKey = this.dateOnlyInTimezone(order.createdAt, range.timezone);
      const day = salesByDayMap.get(dayKey);
      if (day) {
        day.revenueCents += order.totalCents;
        day.orderCount += 1;
      }

      for (const item of order.items.filter(
        (orderItem) => !orderItem.removedAt,
      )) {
        const current = productMap.get(item.productName) ?? {
          productName: item.productName,
          quantity: 0,
          revenueCents: 0,
        };
        current.quantity += item.quantity;
        current.revenueCents += item.lineTotalCents;
        productMap.set(item.productName, current);
      }
    }

    return {
      from: range.from,
      to: range.to,
      totalRevenueCents,
      orderCount,
      averageTicketCents:
        orderCount > 0 ? Math.round(totalRevenueCents / orderCount) : 0,
      salesByDay,
      topProducts: [...productMap.values()]
        .sort((a, b) => b.revenueCents - a.revenueCents)
        .slice(0, 20),
    };
  }

  async transitionOrder(
    orderId: string,
    toStatus: OrderStatus,
    actorId?: string,
    note?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: orderInclude,
      });

      if (!order) {
        throw new NotFoundException("Order not found.");
      }

      assertOrderTransition(order.status, toStatus);

      if (order.status === toStatus) {
        return order;
      }

      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: toStatus,
          paidAt:
            toStatus === OrderStatus.PAID && !order.paidAt
              ? new Date()
              : order.paidAt,
        },
        include: orderInclude,
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus,
          changedById: actorId,
          note,
        },
      });

      return updated;
    });
  }

  ensureCustomerCanSee(orderUserId: string | null, user?: AuthenticatedUser) {
    if (orderUserId && orderUserId !== user?.id) {
      throw new ForbiddenException("You cannot access this order.");
    }
  }

  private buildOrderLine(
    item: CreateOrderDto["items"][number],
    product: CheckoutProduct,
  ) {
    const options = this.resolveOrderItemOptions(item.options ?? [], product);
    const optionUnitPriceCents = options.reduce(
      (sum, option) => sum + option.priceCents,
      0,
    );
    const unitPriceCents = product.priceCents + optionUnitPriceCents;

    return {
      productId: product.id,
      productName: product.name,
      unitPriceCents,
      quantity: item.quantity,
      lineTotalCents: unitPriceCents * item.quantity,
      options,
    };
  }

  private resolveOrderItemOptions(
    selectedOptions: NonNullable<CreateOrderDto["items"][number]["options"]>,
    product: CheckoutProduct,
  ) {
    const groups = product.optionGroups;
    const groupMap = new Map(groups.map((group) => [group.id, group]));
    const selectedByGroup = new Map<string, Set<string>>();

    for (const selected of selectedOptions) {
      const group = groupMap.get(selected.groupId);
      if (!group) {
        throw new BadRequestException(
          `Grupo de opciones no disponible para ${product.name}.`,
        );
      }

      const choiceSet = selectedByGroup.get(group.id) ?? new Set<string>();
      for (const choiceId of selected.choiceIds) {
        choiceSet.add(choiceId);
      }
      selectedByGroup.set(group.id, choiceSet);
    }

    const snapshots: Array<{
      groupName: string;
      choiceName: string;
      priceCents: number;
    }> = [];

    for (const group of groups) {
      const selectedChoiceIds = [...(selectedByGroup.get(group.id) ?? [])];
      const minimumChoices = group.required
        ? Math.max(1, group.minChoices)
        : group.minChoices;

      if (selectedChoiceIds.length < minimumChoices) {
        throw new BadRequestException(
          `Selecciona al menos ${minimumChoices} opcion(es) de ${group.name}.`,
        );
      }

      if (selectedChoiceIds.length > group.maxChoices) {
        throw new BadRequestException(
          `Selecciona como maximo ${group.maxChoices} opcion(es) de ${group.name}.`,
        );
      }

      const choiceMap = new Map(
        group.choices.map((choice) => [choice.id, choice]),
      );

      for (const choiceId of selectedChoiceIds) {
        const choice = choiceMap.get(choiceId);
        if (!choice) {
          throw new BadRequestException(
            `Opcion no disponible para ${group.name}.`,
          );
        }

        snapshots.push({
          groupName: group.name,
          choiceName: choice.name,
          priceCents: choice.priceCents,
        });
      }
    }

    return snapshots;
  }

  private async nextOrderNumber(tx: Prisma.TransactionClient) {
    const timezoneDay = this.dateOnlyInTimezone(
      new Date(),
      this.appTimezone(),
    ).replaceAll("-", "");
    const key = `ORDER_${timezoneDay}`;
    const counter = await tx.sequenceCounter.upsert({
      where: { key },
      update: { value: { increment: 1 } },
      create: { key, value: 1 },
    });

    return `MT-${timezoneDay}-${String(counter.value).padStart(4, "0")}`;
  }

  private trackingToken() {
    return randomBytes(32).toString("base64url");
  }

  private includedTaxCents(totalCents: number, taxRate: number) {
    if (taxRate <= 0) {
      return 0;
    }
    return Math.round(totalCents - totalCents / (1 + taxRate));
  }

  private isUniqueError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }

  private dateRange(from?: string, to?: string) {
    const timezone = this.appTimezone();
    const defaultTo = this.dateOnlyInTimezone(new Date(), timezone);
    const defaultFrom = addDaysToDateOnly(defaultTo, -29);
    const fromDateOnly = from ?? defaultFrom;
    const toDateOnly = to ?? defaultTo;

    this.assertValidDateOnly(fromDateOnly);
    this.assertValidDateOnly(toDateOnly);

    if (fromDateOnly > toDateOnly) {
      throw new BadRequestException(
        "La fecha inicial no puede ser posterior a la final.",
      );
    }

    const fromDate = this.startOfDateOnlyInTimezone(fromDateOnly, timezone);
    const toInclusiveDate = this.startOfDateOnlyInTimezone(
      toDateOnly,
      timezone,
    );
    const toExclusiveDate = this.startOfDateOnlyInTimezone(
      addDaysToDateOnly(toDateOnly, 1),
      timezone,
    );

    return {
      from: fromDateOnly,
      to: toDateOnly,
      timezone,
      fromDate,
      toInclusiveDate,
      toExclusiveDate,
    };
  }

  private currentBusinessDayRange() {
    const timezone = this.appTimezone();
    const date = this.dateOnlyInTimezone(new Date(), timezone);
    return {
      date,
      fromDate: this.startOfDateOnlyInTimezone(date, timezone),
      toExclusiveDate: this.startOfDateOnlyInTimezone(
        addDaysToDateOnly(date, 1),
        timezone,
      ),
    };
  }

  private startOfDateOnlyInTimezone(value: string, timezone: string) {
    const parts = this.parseDateOnly(value);
    const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
    let utc = localAsUtc;

    for (let index = 0; index < 3; index += 1) {
      const offset = this.timezoneOffsetMs(new Date(utc), timezone);
      const next = localAsUtc - offset;
      if (next === utc) {
        break;
      }
      utc = next;
    }

    return new Date(utc);
  }

  private dateOnlyInTimezone(date: Date, timezone: string) {
    const parts = this.dateTimePartsInTimezone(date, timezone);
    return formatDateOnly(parts.year, parts.month, parts.day);
  }

  private timezoneOffsetMs(date: Date, timezone: string) {
    const parts = this.dateTimePartsInTimezone(date, timezone);
    return (
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
      ) - date.getTime()
    );
  }

  private dateTimePartsInTimezone(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);

    return {
      year: Number(parts.find((part) => part.type === "year")?.value),
      month: Number(parts.find((part) => part.type === "month")?.value),
      day: Number(parts.find((part) => part.type === "day")?.value),
      hour: Number(parts.find((part) => part.type === "hour")?.value ?? 0),
      minute: Number(parts.find((part) => part.type === "minute")?.value ?? 0),
      second: Number(parts.find((part) => part.type === "second")?.value ?? 0),
    };
  }

  private assertValidDateOnly(value: string) {
    this.parseDateOnly(value);
  }

  private parseOrderStatus(value: OrderStatus | undefined) {
    if (!value) {
      return undefined;
    }

    if (!Object.values(OrderStatus).includes(value)) {
      throw new BadRequestException("Estado de pedido no valido.");
    }

    return value;
  }

  private parseDeliveryMethod(value: DeliveryMethod | undefined) {
    if (!value) {
      return undefined;
    }

    if (!Object.values(DeliveryMethod).includes(value)) {
      throw new BadRequestException("Metodo de entrega no valido.");
    }

    return value;
  }

  private adminOrderPagination(page?: string, pageSize?: string) {
    if (page === undefined && pageSize === undefined) {
      return undefined;
    }

    const parsedPage = this.parsePositiveInteger(page ?? "1", "Pagina");
    const parsedPageSize = this.parsePositiveInteger(
      pageSize ?? "50",
      "Tamano de pagina",
    );

    if (parsedPageSize > 100) {
      throw new BadRequestException("Tamano de pagina maximo: 100.");
    }

    return {
      skip: (parsedPage - 1) * parsedPageSize,
      take: parsedPageSize,
    };
  }

  private parsePositiveInteger(value: string, field: string) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1) {
      throw new BadRequestException(`${field} no valida.`);
    }

    return number;
  }

  private parseDateOnly(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(
        "Las fechas deben usar el formato YYYY-MM-DD.",
      );
    }

    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      Number.isNaN(date.getTime()) ||
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException("Fecha no valida.");
    }

    return { year, month, day };
  }

  private daysBetween(from: string, to: string) {
    const days: string[] = [];
    const cursor = dateOnlyAsUtcDate(from);
    const end = dateOnlyAsUtcDate(to);

    while (cursor <= end) {
      days.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return days;
  }

  private appTimezone() {
    return this.configService.get("APP_TIMEZONE", { infer: true });
  }
}

function addDaysToDateOnly(value: string, days: number) {
  const date = dateOnlyAsUtcDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateOnlyAsUtcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatDateOnly(year: number, month: number, day: number) {
  return [year, month, day]
    .map((part) => String(part).padStart(2, "0"))
    .join("-");
}

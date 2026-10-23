import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import { CashTrustStatus, OrderStatus, Prisma, Role } from "@prisma/client";
import { CASH_TRUST_INITIAL_REQUIRED_ORDERS } from "../cash-trust/cash-trust.service";
import { AppEnv } from "../config/env";
import { CustomersService } from "../customers/customers.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  formatCustomerDisplayId,
  maskCustomerEmail,
  maskCustomerPhone,
  normalizeCustomerEmail,
  normalizeCustomerPhone,
  normalizeCustomerPostalCode,
} from "../common/customer-identifier";
import {
  CustomerHistoryQueryDto,
  CustomerSegmentKey,
} from "./dto/customer-detail.dto";
import {
  CustomerAccountStatus,
  CustomerListSource,
  CustomerSortField,
  ListAdminCustomersDto,
  SortDirection,
} from "./dto/list-admin-customers.dto";

interface GuestCustomerAggregate {
  normalizedEmail: string;
  normalizedPhone: string;
  name: string;
  postalCode: string | null;
  postalCodeAt: Date | null;
  createdAt: Date;
  lastPurchaseAt: Date;
  deliveredOrders: number;
  cancelledOrders: number;
  totalSpentCents: number;
}

@Injectable()
export class AdminCustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppEnv, true>,
    private readonly customersService: CustomersService,
  ) {}

  async listCustomers(query: ListAdminCustomersDto) {
    if (query.source === CustomerListSource.GUEST) {
      return this.listGuestCustomers(query);
    }

    const where = this.customerWhere(query);
    const orderBy = this.customerOrderBy(query);
    const skip = (query.page - 1) * query.pageSize;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          active: true,
          emailVerifiedAt: true,
          createdAt: true,
          lastLoginAt: true,
          addresses: {
            select: { postalCode: true },
            orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
            take: 1,
          },
        },
        orderBy,
        skip,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    const userIds = users.map((user) => user.id);
    const [deliveredGroups, cancelledGroups] =
      userIds.length === 0
        ? [[], []]
        : await Promise.all([
            this.prisma.order.groupBy({
              by: ["userId"],
              where: {
                userId: { in: userIds },
                status: OrderStatus.DELIVERED,
              },
              _count: { _all: true },
              _sum: { totalCents: true },
              _max: { createdAt: true },
            }),
            this.prisma.order.groupBy({
              by: ["userId"],
              where: {
                userId: { in: userIds },
                status: OrderStatus.CANCELLED,
              },
              _count: { _all: true },
            }),
          ]);

    const deliveredByUser = new Map(
      deliveredGroups.flatMap((group) =>
        group.userId ? [[group.userId, group] as const] : [],
      ),
    );
    const cancelledByUser = new Map(
      cancelledGroups.flatMap((group) =>
        group.userId ? [[group.userId, group._count._all] as const] : [],
      ),
    );

    return {
      items: users.map((user) => {
        const delivered = deliveredByUser.get(user.id);
        const deliveredOrders = delivered?._count._all ?? 0;
        const totalSpentCents = delivered?._sum.totalCents ?? 0;
        const anonymized = user.email.endsWith("@anonymized.invalid");

        return {
          id: user.id,
          displayId: formatCustomerDisplayId(user.id),
          name: user.name,
          accountType: "REGISTERED" as const,
          verificationStatus: user.emailVerifiedAt
            ? ("VERIFIED" as const)
            : ("PENDING" as const),
          maskedEmail: anonymized ? null : maskCustomerEmail(user.email),
          maskedPhone: maskCustomerPhone(user.phone),
          postalCode: normalizeCustomerPostalCode(
            user.addresses[0]?.postalCode,
          ),
          anonymized,
          active: user.active,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          lastPurchaseAt: delivered?._max.createdAt ?? null,
          deliveredOrders,
          cancelledOrders: cancelledByUser.get(user.id) ?? 0,
          totalSpentCents,
          averageTicketCents:
            deliveredOrders === 0
              ? 0
              : Math.round(totalSpentCents / deliveredOrders),
        };
      }),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  private async listGuestCustomers(query: ListAdminCustomersDto) {
    if (query.status === CustomerAccountStatus.DISABLED) {
      return this.emptyCustomerPage(query);
    }

    const search = query.q?.trim();
    const rows = await this.prisma.order.groupBy({
      by: [
        "customerEmail",
        "customerPhone",
        "customerName",
        "deliveryPostalCode",
        "status",
      ],
      where: {
        userId: null,
        ...(search
          ? {
              OR: [
                {
                  customerName: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
                {
                  customerEmail: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
                {
                  customerPhone: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
                {
                  deliveryPostalCode: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
              ],
            }
          : {}),
      },
      _count: { _all: true },
      _sum: { totalCents: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
    });

    const guests = new Map<string, GuestCustomerAggregate>();
    for (const row of rows) {
      const normalizedEmail = normalizeCustomerEmail(row.customerEmail);
      const normalizedPhone =
        normalizeCustomerPhone(row.customerPhone) ?? row.customerPhone.trim();
      const createdAt = row._min.createdAt;
      const lastPurchaseAt = row._max.createdAt;
      if (!createdAt || !lastPurchaseAt) {
        continue;
      }

      const key = `${normalizedEmail}\u0000${normalizedPhone}`;
      const current = guests.get(key);
      const postalCode = normalizeCustomerPostalCode(row.deliveryPostalCode);
      const count = row._count._all;
      const deliveredOrders = row.status === OrderStatus.DELIVERED ? count : 0;
      const cancelledOrders = row.status === OrderStatus.CANCELLED ? count : 0;
      const totalSpentCents =
        row.status === OrderStatus.DELIVERED ? (row._sum.totalCents ?? 0) : 0;

      if (!current) {
        guests.set(key, {
          normalizedEmail,
          normalizedPhone,
          name: row.customerName.trim(),
          postalCode,
          postalCodeAt: postalCode ? lastPurchaseAt : null,
          createdAt,
          lastPurchaseAt,
          deliveredOrders,
          cancelledOrders,
          totalSpentCents,
        });
        continue;
      }

      if (lastPurchaseAt > current.lastPurchaseAt) {
        current.name = row.customerName.trim();
        current.lastPurchaseAt = lastPurchaseAt;
      }
      if (createdAt < current.createdAt) {
        current.createdAt = createdAt;
      }
      if (
        postalCode &&
        (!current.postalCodeAt || lastPurchaseAt > current.postalCodeAt)
      ) {
        current.postalCode = postalCode;
        current.postalCodeAt = lastPurchaseAt;
      }
      current.deliveredOrders += deliveredOrders;
      current.cancelledOrders += cancelledOrders;
      current.totalSpentCents += totalSpentCents;
    }

    const direction = query.sortDirection === SortDirection.ASC ? 1 : -1;
    const sortedGuests = [...guests.values()].sort((left, right) => {
      const primary =
        query.sortBy === CustomerSortField.NAME
          ? left.name.localeCompare(right.name, "es", {
              sensitivity: "base",
            })
          : query.sortBy === CustomerSortField.CREATED_AT
            ? left.createdAt.getTime() - right.createdAt.getTime()
            : left.lastPurchaseAt.getTime() - right.lastPurchaseAt.getTime();
      if (primary !== 0) {
        return primary * direction;
      }

      return (
        left.normalizedEmail.localeCompare(right.normalizedEmail) ||
        left.normalizedPhone.localeCompare(right.normalizedPhone)
      );
    });
    const total = sortedGuests.length;
    const skip = (query.page - 1) * query.pageSize;
    const page = sortedGuests.slice(skip, skip + query.pageSize);

    return {
      items: page.map((guest) => {
        return {
          id: this.guestDisplayId(guest.normalizedEmail, guest.normalizedPhone),
          displayId: this.guestDisplayId(
            guest.normalizedEmail,
            guest.normalizedPhone,
          ),
          name: guest.name,
          accountType: "GUEST" as const,
          verificationStatus: "GUEST" as const,
          maskedEmail: maskCustomerEmail(guest.normalizedEmail),
          maskedPhone: maskCustomerPhone(guest.normalizedPhone),
          postalCode: guest.postalCode,
          anonymized: false,
          active: true,
          createdAt: guest.createdAt,
          lastLoginAt: null,
          lastPurchaseAt: guest.lastPurchaseAt,
          deliveredOrders: guest.deliveredOrders,
          cancelledOrders: guest.cancelledOrders,
          totalSpentCents: guest.totalSpentCents,
          averageTicketCents:
            guest.deliveredOrders === 0
              ? 0
              : Math.round(guest.totalSpentCents / guest.deliveredOrders),
        };
      }),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  private guestDisplayId(email: string, phone: string) {
    const digest = createHash("sha256")
      .update(`${email}\u0000${phone}`)
      .digest("hex")
      .slice(0, 10)
      .toUpperCase();
    return `INV-${digest}`;
  }

  private emptyCustomerPage(query: ListAdminCustomersDto) {
    return {
      items: [],
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: 0,
        totalPages: 1,
      },
    };
  }

  async getCustomerDetail(customerId: string, query: CustomerHistoryQueryDto) {
    const customer = await this.prisma.user.findFirst({
      where: { id: customerId, role: Role.CLIENTE },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        active: true,
        disabledAt: true,
        createdAt: true,
        lastLoginAt: true,
        commercialConsents: {
          select: {
            channel: true,
            grantedAt: true,
            withdrawnAt: true,
            consentVersion: true,
            source: true,
            withdrawalSource: true,
            updatedAt: true,
          },
          orderBy: { channel: "asc" },
        },
        cashTrust: {
          select: {
            status: true,
            cashEnabled: true,
            successfulOrdersCount: true,
            requiredSuccessfulOrders: true,
            lastIncidentReason: true,
            lastIncidentAt: true,
            unlockedAt: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found.");
    }

    const thresholds = this.segmentThresholds();
    const frequentCutoff = this.businessDateStartDaysAgo(
      thresholds.frequentWindowDays,
    );
    const historyWhere: Prisma.OrderWhereInput = { userId: customerId };
    const [
      delivered,
      cancelledOrders,
      frequentWindowOrders,
      orders,
      historyTotal,
      loyalty,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        where: { userId: customerId, status: OrderStatus.DELIVERED },
        _count: { _all: true },
        _sum: { totalCents: true },
        _max: { createdAt: true },
      }),
      this.prisma.order.count({
        where: { userId: customerId, status: OrderStatus.CANCELLED },
      }),
      this.prisma.order.count({
        where: {
          userId: customerId,
          status: OrderStatus.DELIVERED,
          createdAt: { gte: frequentCutoff },
        },
      }),
      this.prisma.order.findMany({
        where: historyWhere,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          deliveryMethod: true,
          paymentMethod: true,
          subtotalCents: true,
          discountCents: true,
          deliveryFeeCents: true,
          taxCents: true,
          totalCents: true,
          currency: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.order.count({ where: historyWhere }),
      this.customersService.getLoyaltyProgress(customerId),
    ]);

    const deliveredOrders = delivered._count._all;
    const totalSpentCents = delivered._sum.totalCents ?? 0;
    const lastPurchaseAt = delivered._max.createdAt;
    const segment = this.classifyCustomer({
      deliveredOrders,
      frequentWindowOrders,
      lastPurchaseAt,
      thresholds,
    });
    const cashTrust = customer.cashTrust ?? {
      status: CashTrustStatus.PENDING_ACTIVATION,
      cashEnabled: false,
      successfulOrdersCount: 0,
      requiredSuccessfulOrders: CASH_TRUST_INITIAL_REQUIRED_ORDERS,
      lastIncidentReason: null,
      lastIncidentAt: null,
      unlockedAt: null,
    };

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        active: customer.active,
        disabledAt: customer.disabledAt,
        createdAt: customer.createdAt,
        lastLoginAt: customer.lastLoginAt,
      },
      metrics: {
        deliveredOrders,
        cancelledOrders,
        totalSpentCents,
        averageTicketCents:
          deliveredOrders === 0
            ? 0
            : Math.round(totalSpentCents / deliveredOrders),
        lastPurchaseAt,
      },
      segment,
      loyalty,
      cashTrust: {
        ...cashTrust,
        ordersRemaining: Math.max(
          cashTrust.requiredSuccessfulOrders - cashTrust.successfulOrdersCount,
          0,
        ),
      },
      commercialConsents: customer.commercialConsents,
      orders,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: historyTotal,
        totalPages: Math.max(1, Math.ceil(historyTotal / query.pageSize)),
      },
    };
  }

  private customerWhere(query: ListAdminCustomersDto): Prisma.UserWhereInput {
    const search = query.q?.trim();

    return {
      role: Role.CLIENTE,
      ...(query.status === CustomerAccountStatus.ACTIVE
        ? { active: true }
        : query.status === CustomerAccountStatus.DISABLED
          ? { active: false }
          : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
  }

  private customerOrderBy(
    query: ListAdminCustomersDto,
  ): Prisma.UserOrderByWithRelationInput[] {
    const direction =
      query.sortDirection === SortDirection.ASC ? "asc" : "desc";
    const field =
      query.sortBy === CustomerSortField.NAME
        ? "name"
        : query.sortBy === CustomerSortField.LAST_LOGIN_AT
          ? "lastLoginAt"
          : "createdAt";

    return [{ [field]: direction }, { id: "asc" }];
  }

  private segmentThresholds() {
    return {
      developingMaxOrders: this.configService.get("CRM_DEVELOPING_MAX_ORDERS", {
        infer: true,
      }),
      frequentOrderThreshold: this.configService.get(
        "CRM_FREQUENT_ORDER_THRESHOLD",
        { infer: true },
      ),
      frequentWindowDays: this.configService.get("CRM_FREQUENT_WINDOW_DAYS", {
        infer: true,
      }),
      inactiveDays: this.configService.get("CRM_INACTIVE_DAYS", {
        infer: true,
      }),
    };
  }

  private classifyCustomer(input: {
    deliveredOrders: number;
    frequentWindowOrders: number;
    lastPurchaseAt: Date | null;
    thresholds: ReturnType<AdminCustomersService["segmentThresholds"]>;
  }) {
    if (input.deliveredOrders === 0 || !input.lastPurchaseAt) {
      return {
        key: CustomerSegmentKey.NEW,
        label: "Nuevo",
        reason: "No tiene pedidos entregados.",
      };
    }

    const inactiveCutoff = this.businessDateStartDaysAgo(
      input.thresholds.inactiveDays,
    );
    if (input.lastPurchaseAt < inactiveCutoff) {
      return {
        key: CustomerSegmentKey.INACTIVE,
        label: "Inactivo",
        reason: `Su ultima compra supera ${input.thresholds.inactiveDays} dias.`,
      };
    }

    if (input.deliveredOrders <= input.thresholds.developingMaxOrders) {
      return {
        key: CustomerSegmentKey.DEVELOPING,
        label: "En desarrollo",
        reason: `Tiene ${input.deliveredOrders} pedido(s) entregado(s); el limite de desarrollo es ${input.thresholds.developingMaxOrders}.`,
      };
    }

    if (input.frequentWindowOrders >= input.thresholds.frequentOrderThreshold) {
      return {
        key: CustomerSegmentKey.FREQUENT,
        label: "Frecuente",
        reason: `Tiene ${input.frequentWindowOrders} pedido(s) entregado(s) en los ultimos ${input.thresholds.frequentWindowDays} dias.`,
      };
    }

    return {
      key: CustomerSegmentKey.ACTIVE,
      label: "Activo",
      reason: `Tiene compras dentro de los ultimos ${input.thresholds.inactiveDays} dias.`,
    };
  }

  private businessDateStartDaysAgo(daysAgo: number) {
    const timezone = this.configService.get("APP_TIMEZONE", { infer: true });
    const nowParts = this.dateTimePartsInTimezone(new Date(), timezone);
    const calendarDate = new Date(
      Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day),
    );
    calendarDate.setUTCDate(calendarDate.getUTCDate() - daysAgo);

    return this.zonedDateStartToUtc(
      calendarDate.getUTCFullYear(),
      calendarDate.getUTCMonth() + 1,
      calendarDate.getUTCDate(),
      timezone,
    );
  }

  private zonedDateStartToUtc(
    year: number,
    month: number,
    day: number,
    timezone: string,
  ) {
    const localAsUtc = Date.UTC(year, month - 1, day);
    let utc = localAsUtc;

    for (let index = 0; index < 3; index += 1) {
      const parts = this.dateTimePartsInTimezone(new Date(utc), timezone);
      const offset =
        Date.UTC(
          parts.year,
          parts.month - 1,
          parts.day,
          parts.hour,
          parts.minute,
          parts.second,
        ) - utc;
      const next = localAsUtc - offset;
      if (next === utc) break;
      utc = next;
    }

    return new Date(utc);
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
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);

    return {
      year: value("year"),
      month: value("month"),
      day: value("day"),
      hour: value("hour"),
      minute: value("minute"),
      second: value("second"),
    };
  }
}

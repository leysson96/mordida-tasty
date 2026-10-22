import { CashTrustStatus, OrderStatus, Role } from "@prisma/client";
import { AdminCustomersService } from "./admin-customers.service";
import { CustomerSegmentKey } from "./dto/customer-detail.dto";

describe("AdminCustomersService detail and segmentation", () => {
  const customerId = "123e4567-e89b-42d3-a456-426614174000";
  const now = new Date("2026-10-21T10:00:00.000Z");
  const prisma = {
    user: {
      findFirst: jest.fn(),
    },
    order: {
      aggregate: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const values = {
    APP_TIMEZONE: "Europe/Madrid",
    CRM_DEVELOPING_MAX_ORDERS: 2,
    CRM_FREQUENT_ORDER_THRESHOLD: 5,
    CRM_FREQUENT_WINDOW_DAYS: 90,
    CRM_INACTIVE_DAYS: 60,
  };
  const configService = {
    get: jest.fn((key: keyof typeof values) => values[key]),
  };
  const customersService = {
    getLoyaltyProgress: jest.fn().mockResolvedValue({
      completedOrders: 0,
      availableRewards: 0,
      rewardReady: false,
    }),
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    jest.clearAllMocks();
    prisma.user.findFirst.mockResolvedValue({
      id: customerId,
      name: "Cliente CRM",
      email: "cliente@example.test",
      phone: "+34600000000",
      active: true,
      disabledAt: null,
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      lastLoginAt: new Date("2026-10-20T10:00:00.000Z"),
      commercialConsents: [],
      cashTrust: null,
      passwordHash: "must-not-leak",
      addresses: [{ street: "must-not-leak" }],
    });
    prisma.order.findMany.mockResolvedValue([]);
    customersService.getLoyaltyProgress.mockResolvedValue({
      completedOrders: 0,
      availableRewards: 0,
      rewardReady: false,
    });
  });

  afterEach(() => jest.useRealTimers());

  function service() {
    return new AdminCustomersService(
      prisma as never,
      configService as never,
      customersService as never,
    );
  }

  function arrangeMetrics(input: {
    delivered: number;
    lastPurchaseAt: Date | null;
    recent: number;
    cancelled?: number;
    historyTotal?: number;
    totalSpentCents?: number;
  }) {
    prisma.order.aggregate.mockResolvedValue({
      _count: { _all: input.delivered },
      _sum: { totalCents: input.totalSpentCents ?? 0 },
      _max: { createdAt: input.lastPurchaseAt },
    });
    prisma.order.count.mockImplementation(
      ({ where }: { where: { status?: OrderStatus; createdAt?: unknown } }) => {
        if (where.status === OrderStatus.CANCELLED) {
          return Promise.resolve(input.cancelled ?? 0);
        }
        if (
          where.status === OrderStatus.DELIVERED &&
          where.createdAt !== undefined
        ) {
          return Promise.resolve(input.recent);
        }
        return Promise.resolve(input.historyTotal ?? input.delivered);
      },
    );
  }

  it.each([
    {
      expected: CustomerSegmentKey.NEW,
      delivered: 0,
      recent: 0,
      lastPurchaseAt: null,
    },
    {
      expected: CustomerSegmentKey.DEVELOPING,
      delivered: 2,
      recent: 2,
      lastPurchaseAt: new Date("2026-10-20T10:00:00.000Z"),
    },
    {
      expected: CustomerSegmentKey.ACTIVE,
      delivered: 4,
      recent: 3,
      lastPurchaseAt: new Date("2026-10-20T10:00:00.000Z"),
    },
    {
      expected: CustomerSegmentKey.FREQUENT,
      delivered: 8,
      recent: 5,
      lastPurchaseAt: new Date("2026-10-20T10:00:00.000Z"),
    },
    {
      expected: CustomerSegmentKey.INACTIVE,
      delivered: 8,
      recent: 0,
      lastPurchaseAt: new Date("2026-08-21T21:59:59.999Z"),
    },
  ])("classifies $expected with an explainable reason", async (scenario) => {
    arrangeMetrics(scenario);

    const result = await service().getCustomerDetail(customerId, {
      page: 1,
      pageSize: 10,
    });

    expect(result.segment.key).toBe(scenario.expected);
    expect(result.segment.reason).toEqual(expect.any(String));
    expect(result.segment.reason.length).toBeGreaterThan(10);
  });

  it("treats the inactivity boundary in APP_TIMEZONE as active", async () => {
    arrangeMetrics({
      delivered: 4,
      recent: 1,
      lastPurchaseAt: new Date("2026-08-21T22:00:00.000Z"),
    });

    const result = await service().getCustomerDetail(customerId, {
      page: 1,
      pageSize: 10,
    });

    expect(result.segment.key).toBe(CustomerSegmentKey.ACTIVE);
    expect(prisma.order.count).toHaveBeenCalledWith({
      where: {
        userId: customerId,
        status: OrderStatus.DELIVERED,
        createdAt: { gte: new Date("2026-07-22T22:00:00.000Z") },
      },
    });
  });

  it("returns paginated safe history, loyalty and default cash trust", async () => {
    const order = {
      id: "order-1",
      orderNumber: "MT-0001",
      status: OrderStatus.DELIVERED,
      totalCents: 1299,
    };
    prisma.order.findMany.mockResolvedValue([order]);
    arrangeMetrics({
      delivered: 3,
      recent: 3,
      lastPurchaseAt: new Date("2026-10-20T10:00:00.000Z"),
      cancelled: 1,
      historyTotal: 4,
      totalSpentCents: 3251,
    });
    customersService.getLoyaltyProgress.mockResolvedValue({
      completedOrders: 3,
      availableRewards: 0,
      rewardReady: false,
    });

    const result = await service().getCustomerDetail(customerId, {
      page: 2,
      pageSize: 2,
    });

    expect(result.metrics).toEqual({
      deliveredOrders: 3,
      cancelledOrders: 1,
      totalSpentCents: 3251,
      averageTicketCents: 1084,
      lastPurchaseAt: new Date("2026-10-20T10:00:00.000Z"),
    });
    expect(prisma.order.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: customerId, status: OrderStatus.DELIVERED },
      }),
    );
    expect(result.cashTrust).toEqual(
      expect.objectContaining({
        status: CashTrustStatus.PENDING_ACTIVATION,
        cashEnabled: false,
        ordersRemaining: 2,
      }),
    );
    expect(result.loyalty).toEqual(
      expect.objectContaining({ completedOrders: 3 }),
    );
    expect(result.orders).toEqual([order]);
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 2,
      total: 4,
      totalPages: 2,
    });
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 2, take: 2 }),
    );
    expect(JSON.stringify(result)).not.toContain("must-not-leak");
  });

  it("rejects non-customer identifiers", async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service().getCustomerDetail(customerId, { page: 1, pageSize: 10 }),
    ).rejects.toThrow("Customer not found.");
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: customerId, role: Role.CLIENTE },
      }),
    );
  });
});

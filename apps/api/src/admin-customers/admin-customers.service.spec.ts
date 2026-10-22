import { OrderStatus, Role } from "@prisma/client";
import { AdminCustomersService } from "./admin-customers.service";
import {
  CustomerAccountStatus,
  CustomerSortField,
  ListAdminCustomersDto,
  SortDirection,
} from "./dto/list-admin-customers.dto";

describe("AdminCustomersService", () => {
  const prisma = {
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    order: {
      groupBy: jest.fn(),
    },
  };
  const configService = { get: jest.fn() };
  const customersService = { getLoyaltyProgress: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.count.mockResolvedValue(1);
  });

  function service() {
    return new AdminCustomersService(
      prisma as never,
      configService as never,
      customersService as never,
    );
  }

  it("applies server-side search, status, sorting and pagination", async () => {
    prisma.user.findMany.mockResolvedValue([]);

    await service().listCustomers({
      q: "  ana  ",
      status: CustomerAccountStatus.ACTIVE,
      sortBy: CustomerSortField.NAME,
      sortDirection: SortDirection.ASC,
      page: 3,
      pageSize: 20,
    });

    const expectedWhere = {
      role: Role.CLIENTE,
      active: true,
      OR: [
        { name: { contains: "ana", mode: "insensitive" } },
        { email: { contains: "ana", mode: "insensitive" } },
        { phone: { contains: "ana", mode: "insensitive" } },
      ],
    };
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: expectedWhere,
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: 40,
      take: 20,
    });
    expect(prisma.user.count).toHaveBeenCalledWith({ where: expectedWhere });
    expect(prisma.order.groupBy).not.toHaveBeenCalled();
  });

  it("calculates delivered, cancelled, spend, average and last purchase", async () => {
    const createdAt = new Date("2026-10-01T12:00:00.000Z");
    const lastLoginAt = new Date("2026-10-20T18:00:00.000Z");
    const lastPurchaseAt = new Date("2026-10-19T20:00:00.000Z");
    prisma.user.findMany.mockResolvedValue([
      {
        id: "customer-1",
        name: "Ana Cliente",
        email: "ana@example.test",
        phone: "+34600000000",
        active: true,
        createdAt,
        lastLoginAt,
        passwordHash: "must-not-leak",
        addresses: [{ street: "must-not-leak" }],
      },
    ]);
    prisma.order.groupBy
      .mockResolvedValueOnce([
        {
          userId: "customer-1",
          _count: { _all: 3 },
          _sum: { totalCents: 3251 },
          _max: { createdAt: lastPurchaseAt },
        },
      ])
      .mockResolvedValueOnce([
        { userId: "customer-1", _count: { _all: 2 } },
      ]);

    const result = await service().listCustomers(new ListAdminCustomersDto());

    expect(prisma.order.groupBy).toHaveBeenNthCalledWith(1, {
      by: ["userId"],
      where: {
        userId: { in: ["customer-1"] },
        status: OrderStatus.DELIVERED,
      },
      _count: { _all: true },
      _sum: { totalCents: true },
      _max: { createdAt: true },
    });
    expect(result.items[0]).toEqual({
      id: "customer-1",
      name: "Ana Cliente",
      anonymized: false,
      active: true,
      createdAt,
      lastLoginAt,
      lastPurchaseAt,
      deliveredOrders: 3,
      cancelledOrders: 2,
      totalSpentCents: 3251,
      averageTicketCents: 1084,
    });
    expect(JSON.stringify(result)).not.toContain("must-not-leak");
    expect(JSON.stringify(result)).not.toContain("ana@example.test");
    expect(JSON.stringify(result)).not.toContain("+34600000000");
  });

  it("returns zero metrics for a customer without orders", async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: "customer-new",
        name: "Cliente nuevo",
        email: "nuevo@example.test",
        phone: null,
        active: true,
        createdAt: new Date("2026-10-21T10:00:00.000Z"),
        lastLoginAt: null,
      },
    ]);
    prisma.order.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await service().listCustomers(new ListAdminCustomersDto());

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        lastPurchaseAt: null,
        deliveredOrders: 0,
        cancelledOrders: 0,
        totalSpentCents: 0,
        averageTicketCents: 0,
      }),
    );
  });
});

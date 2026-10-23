import { OrderStatus, Role } from "@prisma/client";
import { AdminCustomersService } from "./admin-customers.service";
import {
  CustomerAccountStatus,
  CustomerListSource,
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
        emailVerifiedAt: new Date("2026-09-30T12:00:00.000Z"),
        createdAt,
        lastLoginAt,
        addresses: [{ postalCode: " 15-001 ", street: "must-not-leak" }],
        passwordHash: "must-not-leak",
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
      .mockResolvedValueOnce([{ userId: "customer-1", _count: { _all: 2 } }]);

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
      displayId: "CLI-USTOMER1",
      name: "Ana Cliente",
      accountType: "REGISTERED",
      verificationStatus: "VERIFIED",
      maskedEmail: "a***a@example.test",
      maskedPhone: "+34*****0000",
      postalCode: "15001",
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
        emailVerifiedAt: null,
        createdAt: new Date("2026-10-21T10:00:00.000Z"),
        lastLoginAt: null,
        addresses: [],
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

  it("keeps accounts with the same name distinguishable by their stable ID", async () => {
    const createdAt = new Date("2026-10-21T10:00:00.000Z");
    prisma.user.count.mockResolvedValue(2);
    prisma.user.findMany.mockResolvedValue([
      {
        id: "11111111-1111-1111-1111-aaaaaaaaaaaa",
        name: "Alexis Palmeiro Meitin",
        email: "alexis.one@example.test",
        phone: "+34611111111",
        active: true,
        emailVerifiedAt: createdAt,
        createdAt,
        lastLoginAt: null,
        addresses: [{ postalCode: "15001" }],
      },
      {
        id: "22222222-2222-2222-2222-bbbbbbbbbbbb",
        name: "Alexis Palmeiro Meitin",
        email: "alexis.two@example.test",
        phone: "+34622222222",
        active: true,
        emailVerifiedAt: null,
        createdAt,
        lastLoginAt: null,
        addresses: [{ postalCode: "15002" }],
      },
    ]);
    prisma.order.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await service().listCustomers(new ListAdminCustomersDto());

    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.displayId)).toEqual([
      "CLI-AAAAAAAA",
      "CLI-BBBBBBBB",
    ]);
    expect(new Set(result.items.map((item) => item.id)).size).toBe(2);
    expect(result.items.map((item) => item.maskedEmail)).toEqual([
      "al***ne@example.test",
      "al***wo@example.test",
    ]);
  });

  it("lists guest buyers separately without exposing raw contact data", async () => {
    prisma.order.groupBy.mockResolvedValue([
      {
        customerEmail: " Guest@Example.Test ",
        customerPhone: "611 752 804",
        customerName: "Invitado inicial",
        deliveryPostalCode: null,
        status: OrderStatus.DELIVERED,
        _count: { _all: 2 },
        _sum: { totalCents: 3000 },
        _min: { createdAt: new Date("2026-10-01T10:00:00.000Z") },
        _max: { createdAt: new Date("2026-10-15T10:00:00.000Z") },
      },
      {
        customerEmail: "guest@example.test",
        customerPhone: "+34 611 752 804",
        customerName: "Invitado",
        deliveryPostalCode: "15-001",
        status: OrderStatus.CANCELLED,
        _count: { _all: 1 },
        _sum: { totalCents: 1000 },
        _min: { createdAt: new Date("2026-10-20T10:00:00.000Z") },
        _max: { createdAt: new Date("2026-10-20T10:00:00.000Z") },
      },
    ]);

    const query = new ListAdminCustomersDto();
    query.source = CustomerListSource.GUEST;
    const result = await service().listCustomers(query);

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^INV-[A-F0-9]{10}$/),
        displayId: expect.stringMatching(/^INV-[A-F0-9]{10}$/),
        accountType: "GUEST",
        verificationStatus: "GUEST",
        maskedEmail: "gu***st@example.test",
        maskedPhone: "+34*****2804",
        postalCode: "15001",
        deliveredOrders: 2,
        cancelledOrders: 1,
        totalSpentCents: 3000,
        averageTicketCents: 1500,
      }),
    );
    expect(result.pagination.total).toBe(1);
    expect(prisma.order.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: [
          "customerEmail",
          "customerPhone",
          "customerName",
          "deliveryPostalCode",
          "status",
        ],
        where: { userId: null },
      }),
    );
    expect(JSON.stringify(result)).not.toContain("guest@example.test");
    expect(JSON.stringify(result)).not.toContain("+34611752804");
  });
});

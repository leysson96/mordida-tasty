import { ConfigService } from "@nestjs/config";
import {
  DiscountScope,
  DiscountType,
  DiscountWeekday,
} from "@prisma/client";
import { AppEnv } from "../config/env";
import {
  DiscountForResolution,
  PromotionsService,
} from "./promotions.service";

describe("PromotionsService", () => {
  const prisma = {
    discount: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    discountProduct: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
    },
    category: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const config = {
    get: jest.fn((key: keyof AppEnv) =>
      key === "APP_TIMEZONE" ? "Europe/Madrid" : undefined,
    ),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: keyof AppEnv) =>
      key === "APP_TIMEZONE" ? "Europe/Madrid" : undefined,
    );
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );
  });

  function service() {
    return new PromotionsService(
      prisma as never,
      config as unknown as ConfigService<AppEnv, true>,
    );
  }

  it("queries active discounts for products, categories and order totals", async () => {
    prisma.discount.findMany.mockResolvedValue([]);
    const now = new Date("2026-09-14T10:00:00.000Z");

    await expect(
      service().listActiveDiscountsForCheckout({
        productIds: [" product-1 ", "product-1", ""],
        categoryIds: ["category-1"],
        now,
      }),
    ).resolves.toEqual([]);

    expect(prisma.discount.findMany).toHaveBeenCalledWith({
      where: {
        active: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
        OR: [
          { scope: DiscountScope.ORDER_TOTAL },
          {
            scope: DiscountScope.PRODUCTS,
            products: {
              some: {
                productId: { in: ["product-1"] },
              },
            },
          },
          {
            scope: DiscountScope.CATEGORY,
            categoryId: { in: ["category-1"] },
          },
        ],
      },
      include: {
        products: {
          select: {
            productId: true,
          },
        },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
  });

  it("lists public discount campaigns inside the date window without filtering weekdays", async () => {
    const now = new Date("2026-09-15T10:00:00.000Z");
    prisma.discount.findMany.mockResolvedValue([
      makePublicDiscountCampaign({
        id: "weekend-promo",
        name: "Promo finde",
        endsAt: new Date("2026-09-30T21:59:59.999Z"),
        weekdays: [DiscountWeekday.SAT, DiscountWeekday.SUN],
        products: [{ productId: "product-1" }],
      }),
    ]);

    await expect(service().listPublicDiscountCampaigns(now)).resolves.toEqual([
      expect.objectContaining({
        id: "weekend-promo",
        name: "Promo finde",
        active: true,
        startsOn: "2026-09-01",
        endsOn: "2026-09-30",
        weekdays: [DiscountWeekday.SAT, DiscountWeekday.SUN],
        productIds: ["product-1"],
      }),
    ]);

    expect(prisma.discount.findMany).toHaveBeenCalledWith({
      where: {
        active: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
        scope: {
          in: [DiscountScope.PRODUCTS, DiscountScope.CATEGORY],
        },
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            active: true,
          },
        },
        products: {
          select: {
            productId: true,
          },
        },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
  });

  it("applies a percentage discount to a product line", () => {
    const discount = makeDiscount({
      type: DiscountType.PERCENTAGE,
      value: 1500,
      products: [{ productId: "product-1" }],
    });

    expect(
      service().resolveLineDiscount({
        productId: "product-1",
        categoryId: "category-1",
        unitPriceCents: 1190,
        quantity: 2,
        discounts: [discount],
        now: new Date("2026-09-14T10:00:00.000Z"),
      }),
    ).toEqual({
      discountId: "discount-1",
      discountName: "Promo",
      discountType: DiscountType.PERCENTAGE,
      discountValue: 1500,
      priority: 0,
      originalUnitPriceCents: 1190,
      discountedUnitPriceCents: 1011,
      unitDiscountCents: 179,
      quantity: 2,
      originalLineTotalCents: 2380,
      lineDiscountCents: 358,
      lineTotalCents: 2022,
    });
  });

  it("caps fixed discounts so a line never becomes negative", () => {
    const discount = makeDiscount({
      type: DiscountType.FIXED_AMOUNT,
      value: 2000,
      products: [{ productId: "product-1" }],
    });

    expect(
      service().resolveLineDiscount({
        productId: "product-1",
        categoryId: "category-1",
        unitPriceCents: 750,
        quantity: 2,
        discounts: [discount],
        now: new Date("2026-09-14T10:00:00.000Z"),
      }),
    ).toMatchObject({
      discountedUnitPriceCents: 0,
      unitDiscountCents: 750,
      lineDiscountCents: 1500,
      lineTotalCents: 0,
    });
  });

  it("uses priority before discount amount when several discounts match", () => {
    const lowerPriorityBiggerDiscount = makeDiscount({
      id: "discount-low",
      priority: 1,
      type: DiscountType.PERCENTAGE,
      value: 5000,
      products: [{ productId: "product-1" }],
    });
    const higherPrioritySmallerDiscount = makeDiscount({
      id: "discount-high",
      priority: 5,
      type: DiscountType.PERCENTAGE,
      value: 1000,
      products: [{ productId: "product-1" }],
    });

    expect(
      service().resolveLineDiscount({
        productId: "product-1",
        categoryId: "category-1",
        unitPriceCents: 1000,
        quantity: 1,
        discounts: [lowerPriorityBiggerDiscount, higherPrioritySmallerDiscount],
        now: new Date("2026-09-14T10:00:00.000Z"),
      })?.discountId,
    ).toBe("discount-high");
  });

  it("uses the biggest discount when priority ties", () => {
    const smallerDiscount = makeDiscount({
      id: "discount-smaller",
      priority: 3,
      type: DiscountType.PERCENTAGE,
      value: 1000,
      products: [{ productId: "product-1" }],
    });
    const biggerDiscount = makeDiscount({
      id: "discount-bigger",
      priority: 3,
      type: DiscountType.PERCENTAGE,
      value: 2500,
      products: [{ productId: "product-1" }],
    });

    expect(
      service().resolveLineDiscount({
        productId: "product-1",
        categoryId: "category-1",
        unitPriceCents: 1000,
        quantity: 1,
        discounts: [smallerDiscount, biggerDiscount],
        now: new Date("2026-09-14T10:00:00.000Z"),
      })?.discountId,
    ).toBe("discount-bigger");
  });

  it("applies category discounts and ignores order-total discounts for line resolution", () => {
    const categoryDiscount = makeDiscount({
      id: "category-discount",
      scope: DiscountScope.CATEGORY,
      categoryId: "category-1",
      type: DiscountType.FIXED_AMOUNT,
      value: 100,
    });
    const orderTotalDiscount = makeDiscount({
      id: "order-discount",
      scope: DiscountScope.ORDER_TOTAL,
      type: DiscountType.FIXED_AMOUNT,
      value: 900,
    });

    expect(
      service().resolveLineDiscount({
        productId: "product-1",
        categoryId: "category-1",
        unitPriceCents: 1000,
        quantity: 1,
        discounts: [orderTotalDiscount, categoryDiscount],
        now: new Date("2026-09-14T10:00:00.000Z"),
      })?.discountId,
    ).toBe("category-discount");
  });

  it("uses Europe/Madrid for weekday eligibility", () => {
    const sundayInMadrid = new Date("2026-09-19T22:30:00.000Z");
    const discount = makeDiscount({
      weekdays: [DiscountWeekday.SUN],
      products: [{ productId: "product-1" }],
    });

    expect(
      service().resolveLineDiscount({
        productId: "product-1",
        categoryId: "category-1",
        unitPriceCents: 1000,
        quantity: 1,
        discounts: [discount],
        now: sundayInMadrid,
      }),
    ).toMatchObject({ discountId: "discount-1" });
  });

  it("returns no line discount outside the date window or weekday window", () => {
    const expired = makeDiscount({
      id: "expired",
      startsAt: new Date("2026-09-01T00:00:00.000Z"),
      endsAt: new Date("2026-09-02T00:00:00.000Z"),
      products: [{ productId: "product-1" }],
    });
    const wrongWeekday = makeDiscount({
      id: "wrong-weekday",
      weekdays: [DiscountWeekday.SUN],
      products: [{ productId: "product-1" }],
    });

    expect(
      service().resolveLineDiscount({
        productId: "product-1",
        categoryId: "category-1",
        unitPriceCents: 1000,
        quantity: 1,
        discounts: [expired, wrongWeekday],
        now: new Date("2026-09-14T10:00:00.000Z"),
      }),
    ).toBeUndefined();
  });

  it("creates admin product discounts inactive by default using Madrid dates", async () => {
    prisma.product.findMany.mockResolvedValue([{ id: "product-1" }]);
    prisma.discount.create.mockResolvedValue(
      makeAdminDiscount({
        name: "Finde Smash",
        description: "15% finde",
        active: false,
        type: DiscountType.PERCENTAGE,
        value: 1500,
        startsAt: new Date("2026-09-18T22:00:00.000Z"),
        endsAt: new Date("2026-09-20T21:59:59.999Z"),
        weekdays: [DiscountWeekday.SAT, DiscountWeekday.SUN],
        priority: 5,
        products: [
          {
            productId: "product-1",
            product: makeAdminProduct({ id: "product-1" }),
          },
        ],
      }),
    );

    await expect(
      service().createAdminDiscount({
        name: " Finde Smash ",
        description: " 15% finde ",
        type: DiscountType.PERCENTAGE,
        value: 1500,
        scope: DiscountScope.PRODUCTS,
        startsOn: "2026-09-19",
        endsOn: "2026-09-20",
        weekdays: [DiscountWeekday.SAT, DiscountWeekday.SUN],
        priority: 5,
        productIds: [" product-1 ", "product-1"],
      }),
    ).resolves.toMatchObject({
      name: "Finde Smash",
      description: "15% finde",
      active: false,
      startsOn: "2026-09-19",
      endsOn: "2026-09-20",
      productIds: ["product-1"],
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["product-1"] } },
      select: { id: true },
    });
    expect(prisma.discount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Finde Smash",
        description: "15% finde",
        active: false,
        type: DiscountType.PERCENTAGE,
        value: 1500,
        scope: DiscountScope.PRODUCTS,
        startsAt: new Date("2026-09-18T22:00:00.000Z"),
        endsAt: new Date("2026-09-20T21:59:59.999Z"),
        weekdays: [DiscountWeekday.SAT, DiscountWeekday.SUN],
        stackable: false,
        priority: 5,
        categoryId: null,
        products: {
          create: [{ productId: "product-1" }],
        },
      }),
      include: expect.any(Object),
    });
  });

  it("rejects invalid admin discount values before touching products", async () => {
    await expect(
      service().createAdminDiscount({
        name: "Demasiado descuento",
        type: DiscountType.PERCENTAGE,
        value: 10_001,
        scope: DiscountScope.PRODUCTS,
        startsOn: "2026-09-19",
        endsOn: "2026-09-20",
        productIds: ["product-1"],
      }),
    ).rejects.toThrow("Percentage discounts must be <= 10000 basis points.");

    expect(prisma.product.findMany).not.toHaveBeenCalled();
    expect(prisma.discount.create).not.toHaveBeenCalled();
  });

  it("does not allow order-total discounts from the admin yet", async () => {
    await expect(
      service().createAdminDiscount({
        name: "Pedido completo",
        type: DiscountType.FIXED_AMOUNT,
        value: 300,
        scope: DiscountScope.ORDER_TOTAL,
        startsOn: "2026-09-19",
        endsOn: "2026-09-20",
      }),
    ).rejects.toThrow("Order-total discounts are not available");

    expect(prisma.discount.create).not.toHaveBeenCalled();
  });

  it("updates admin discounts and replaces product links when scope changes", async () => {
    prisma.discount.findUnique.mockResolvedValue(
      makeAdminDiscount({
        id: "discount-1",
        scope: DiscountScope.PRODUCTS,
        products: [
          {
            productId: "product-1",
            product: makeAdminProduct({ id: "product-1" }),
          },
        ],
      }),
    );
    prisma.category.findUnique.mockResolvedValue({ id: "category-1" });
    prisma.discount.update.mockResolvedValue(
      makeAdminDiscount({
        id: "discount-1",
        active: true,
        scope: DiscountScope.CATEGORY,
        categoryId: "category-1",
        category: makeAdminCategory({ id: "category-1" }),
        products: [],
      }),
    );

    await expect(
      service().updateAdminDiscount("discount-1", {
        active: true,
        scope: DiscountScope.CATEGORY,
        categoryId: "category-1",
      }),
    ).resolves.toMatchObject({
      id: "discount-1",
      active: true,
      scope: DiscountScope.CATEGORY,
      categoryId: "category-1",
      productIds: [],
    });

    expect(prisma.discountProduct.deleteMany).toHaveBeenCalledWith({
      where: { discountId: "discount-1" },
    });
    expect(prisma.discountProduct.createMany).not.toHaveBeenCalled();
    expect(prisma.discount.update).toHaveBeenCalledWith({
      where: { id: "discount-1" },
      data: expect.objectContaining({
        active: true,
        scope: DiscountScope.CATEGORY,
        categoryId: "category-1",
      }),
      include: expect.any(Object),
    });
  });

  it("deactivates admin discounts without deleting history", async () => {
    prisma.discount.findUnique.mockResolvedValue(
      makeAdminDiscount({ id: "discount-1", active: true }),
    );
    prisma.discount.update.mockResolvedValue(
      makeAdminDiscount({ id: "discount-1", active: false }),
    );

    await expect(
      service().deactivateAdminDiscount("discount-1"),
    ).resolves.toMatchObject({
      id: "discount-1",
      active: false,
    });

    expect(prisma.discount.update).toHaveBeenCalledWith({
      where: { id: "discount-1" },
      data: { active: false },
      include: expect.any(Object),
    });
  });
});

function makeDiscount(
  overrides: Partial<DiscountForResolution> = {},
): DiscountForResolution {
  return {
    id: overrides.id ?? "discount-1",
    name: overrides.name ?? "Promo",
    description: overrides.description ?? null,
    active: overrides.active ?? true,
    type: overrides.type ?? DiscountType.PERCENTAGE,
    value: overrides.value ?? 1000,
    scope: overrides.scope ?? DiscountScope.PRODUCTS,
    startsAt: overrides.startsAt ?? new Date("2026-09-01T00:00:00.000Z"),
    endsAt: overrides.endsAt ?? new Date("2026-09-30T23:59:59.000Z"),
    weekdays: overrides.weekdays ?? [],
    stackable: overrides.stackable ?? false,
    priority: overrides.priority ?? 0,
    categoryId: overrides.categoryId ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-09-01T00:00:00.000Z"),
    products: overrides.products ?? [],
  };
}

function makeAdminDiscount(
  overrides: {
    id?: string;
    name?: string;
    description?: string | null;
    active?: boolean;
    type?: DiscountType;
    value?: number;
    scope?: DiscountScope;
    startsAt?: Date;
    endsAt?: Date;
    weekdays?: DiscountWeekday[];
    stackable?: boolean;
    priority?: number;
    categoryId?: string | null;
    category?: ReturnType<typeof makeAdminCategory> | null;
    products?: Array<{
      productId: string;
      product: ReturnType<typeof makeAdminProduct>;
    }>;
  } = {},
) {
  return {
    id: overrides.id ?? "discount-1",
    name: overrides.name ?? "Promo",
    description: overrides.description ?? null,
    active: overrides.active ?? true,
    type: overrides.type ?? DiscountType.PERCENTAGE,
    value: overrides.value ?? 1000,
    scope: overrides.scope ?? DiscountScope.PRODUCTS,
    startsAt: overrides.startsAt ?? new Date("2026-09-01T00:00:00.000Z"),
    endsAt: overrides.endsAt ?? new Date("2026-09-30T23:59:59.000Z"),
    weekdays: overrides.weekdays ?? [],
    stackable: overrides.stackable ?? false,
    priority: overrides.priority ?? 0,
    categoryId: overrides.categoryId ?? null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    category: overrides.category ?? null,
    products: overrides.products ?? [],
  };
}

function makePublicDiscountCampaign(
  overrides: {
    id?: string;
    name?: string;
    description?: string | null;
    active?: boolean;
    type?: DiscountType;
    value?: number;
    scope?: DiscountScope;
    startsAt?: Date;
    endsAt?: Date;
    weekdays?: DiscountWeekday[];
    stackable?: boolean;
    priority?: number;
    categoryId?: string | null;
    category?: ReturnType<typeof makeAdminCategory> | null;
    products?: Array<{ productId: string }>;
  } = {},
) {
  return {
    id: overrides.id ?? "discount-1",
    name: overrides.name ?? "Promo",
    description: overrides.description ?? null,
    active: overrides.active ?? true,
    type: overrides.type ?? DiscountType.PERCENTAGE,
    value: overrides.value ?? 1000,
    scope: overrides.scope ?? DiscountScope.PRODUCTS,
    startsAt: overrides.startsAt ?? new Date("2026-09-01T00:00:00.000Z"),
    endsAt: overrides.endsAt ?? new Date("2026-09-30T23:59:59.000Z"),
    weekdays: overrides.weekdays ?? [],
    stackable: overrides.stackable ?? false,
    priority: overrides.priority ?? 0,
    categoryId: overrides.categoryId ?? null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    category: overrides.category ?? null,
    products: overrides.products ?? [],
  };
}

function makeAdminCategory(overrides: { id?: string; active?: boolean } = {}) {
  return {
    id: overrides.id ?? "category-1",
    name: "Hamburguesas",
    slug: "hamburguesas",
    active: overrides.active ?? true,
  };
}

function makeAdminProduct(overrides: { id?: string; active?: boolean } = {}) {
  return {
    id: overrides.id ?? "product-1",
    categoryId: "category-1",
    name: "Mordida Smash",
    slug: "mordida-smash",
    priceCents: 1190,
    active: overrides.active ?? true,
    available: true,
    category: makeAdminCategory(),
  };
}

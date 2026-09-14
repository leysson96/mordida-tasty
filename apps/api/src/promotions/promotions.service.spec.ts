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
    },
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

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DiscountType } from "@prisma/client";
import { ProductsService } from "./products.service";

describe("ProductsService", () => {
  const prisma = {
    category: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    product: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    productOptionGroup: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    productOptionChoice: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as {
    category: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
    product: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    productOptionGroup: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    productOptionChoice: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  const promotions = {
    listActiveDiscountsForCheckout: jest.fn(),
    resolveLineDiscount: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) =>
      key === "API_PUBLIC_URL"
        ? "https://mordida-tasty-api.onrender.com"
        : undefined,
    ),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    promotions.listActiveDiscountsForCheckout.mockResolvedValue([]);
    promotions.resolveLineDiscount.mockReturnValue(undefined);
  });

  function service() {
    return new ProductsService(
      prisma as never,
      promotions as never,
      config as never,
    );
  }

  it("adds backend-calculated promotion pricing to public menu products", async () => {
    const discount = {
      id: "discount-1",
      name: "Promo lunes",
    };
    prisma.category.findMany.mockResolvedValue([
      {
        id: "category-1",
        name: "Hamburguesas",
        products: [
          {
            id: "product-1",
            categoryId: "category-1",
            name: "Mordida Smash",
            priceCents: 1190,
            optionGroups: [],
          },
        ],
      },
    ]);
    promotions.listActiveDiscountsForCheckout.mockResolvedValue([discount]);
    promotions.resolveLineDiscount.mockReturnValue({
      discountId: "discount-1",
      discountName: "Promo lunes",
      discountType: DiscountType.PERCENTAGE,
      discountValue: 2000,
      priority: 20,
      originalUnitPriceCents: 1190,
      discountedUnitPriceCents: 952,
      unitDiscountCents: 238,
      quantity: 1,
      originalLineTotalCents: 1190,
      lineDiscountCents: 238,
      lineTotalCents: 952,
    });

    await expect(service().listMenu()).resolves.toEqual([
      expect.objectContaining({
        products: [
          expect.objectContaining({
            id: "product-1",
            promotionPricing: {
              discountId: "discount-1",
              discountName: "Promo lunes",
              discountType: DiscountType.PERCENTAGE,
              discountValue: 2000,
              priority: 20,
              originalUnitPriceCents: 1190,
              discountedUnitPriceCents: 952,
              unitDiscountCents: 238,
            },
          }),
        ],
      }),
    ]);

    expect(promotions.listActiveDiscountsForCheckout).toHaveBeenCalledWith({
      productIds: ["product-1"],
      categoryIds: ["category-1"],
    });
    expect(promotions.resolveLineDiscount).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "product-1",
        categoryId: "category-1",
        unitPriceCents: 1190,
        quantity: 1,
        discounts: [discount],
      }),
    );
  });

  it("only exposes product detail pages for active products in active categories", async () => {
    prisma.product.findFirst.mockResolvedValue({
      id: "product-1",
      slug: "mordida-smash",
      active: true,
      categoryId: "category-1",
      priceCents: 1190,
      category: { active: true },
    });

    await expect(
      service().getProductBySlug("mordida-smash"),
    ).resolves.toMatchObject({
      id: "product-1",
      promotionPricing: null,
    });

    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: {
        slug: "mordida-smash",
        active: true,
        category: {
          active: true,
        },
      },
      include: {
        category: true,
        optionGroups: expect.any(Object),
      },
    });
    expect(promotions.listActiveDiscountsForCheckout).toHaveBeenCalledWith({
      productIds: ["product-1"],
      categoryIds: ["category-1"],
    });
  });

  it("returns not found when the public product lookup is filtered out", async () => {
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(
      service().getProductBySlug("hidden"),
    ).rejects.toThrow(NotFoundException);
  });

  it("accepts Cloudinary image URLs when creating products", async () => {
    const cloudinaryUrl =
      "https://res.cloudinary.com/demo/image/upload/v123/mordida/burger.jpg";
    prisma.category.findUnique.mockResolvedValue({ id: "category-1" });
    prisma.product.findUnique.mockResolvedValue(null);
    prisma.product.create.mockResolvedValue({
      id: "product-1",
      imageUrl: cloudinaryUrl,
    });

    await expect(
      service().createProduct({
        categoryId: "category-1",
        description: "Burger",
        imageUrl: ` ${cloudinaryUrl} `,
        name: "Mordida",
        priceCents: 750,
      }),
    ).resolves.toMatchObject({ id: "product-1", imageUrl: cloudinaryUrl });

    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          imageUrl: cloudinaryUrl,
        }),
      }),
    );
  });

  it("accepts API upload paths when creating products", async () => {
    prisma.category.findUnique.mockResolvedValue({ id: "category-1" });
    prisma.product.findUnique.mockResolvedValue(null);
    prisma.product.create.mockResolvedValue({
      id: "product-1",
      imageUrl: "/uploads/menu/burger.webp",
    });

    await service().createProduct({
      categoryId: "category-1",
      description: "Burger",
      imageUrl: "/uploads/menu/burger.webp",
      name: "Mordida",
      priceCents: 750,
    });

    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          imageUrl: "/uploads/menu/burger.webp",
        }),
      }),
    );
  });

  it("accepts API upload URLs from the configured API origin", async () => {
    const apiUploadUrl =
      "https://mordida-tasty-api.onrender.com/uploads/images/burger.webp";
    prisma.category.findUnique.mockResolvedValue({ id: "category-1" });
    prisma.product.findUnique.mockResolvedValue(null);
    prisma.product.create.mockResolvedValue({
      id: "product-1",
      imageUrl: apiUploadUrl,
    });

    await service().createProduct({
      categoryId: "category-1",
      description: "Burger",
      imageUrl: apiUploadUrl,
      name: "Mordida",
      priceCents: 750,
    });

    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          imageUrl: apiUploadUrl,
        }),
      }),
    );
  });

  it("rejects external image URLs when creating products", async () => {
    prisma.category.findUnique.mockResolvedValue({ id: "category-1" });
    prisma.product.findUnique.mockResolvedValue(null);

    await expect(
      service().createProduct({
        categoryId: "category-1",
        description: "Burger",
        imageUrl: "https://example.com/burger.jpg",
        name: "Mordida",
        priceCents: 750,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it("rejects API upload lookalike hosts when creating products", async () => {
    prisma.category.findUnique.mockResolvedValue({ id: "category-1" });
    prisma.product.findUnique.mockResolvedValue(null);

    await expect(
      service().createProduct({
        categoryId: "category-1",
        description: "Burger",
        imageUrl:
          "https://mordida-tasty-api.onrender.com.evil.test/uploads/images/burger.webp",
        name: "Mordida",
        priceCents: 750,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it("rejects external image URLs when updating products", async () => {
    prisma.product.findUnique.mockResolvedValue({ id: "product-1" });

    await expect(
      service().updateProduct("product-1", {
        imageUrl: "https://cdn.example.com/burger.jpg",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it("normalizes required option groups before creating them", async () => {
    prisma.product.findUnique.mockResolvedValue({ id: "product-1" });
    prisma.productOptionGroup.create.mockResolvedValue({
      id: "group-1",
      productId: "product-1",
      name: "Punto",
      required: true,
      minChoices: 1,
      maxChoices: 2,
      choices: [],
    });

    await expect(
      service().createOptionGroup("product-1", {
        name: " Punto ",
        required: true,
        maxChoices: 2,
      }),
    ).resolves.toMatchObject({
      id: "group-1",
      minChoices: 1,
      maxChoices: 2,
    });

    expect(prisma.productOptionGroup.create).toHaveBeenCalledWith({
      data: {
        productId: "product-1",
        name: "Punto",
        required: true,
        minChoices: 1,
        maxChoices: 2,
        sortOrder: 0,
      },
      include: { choices: true },
    });
  });
});

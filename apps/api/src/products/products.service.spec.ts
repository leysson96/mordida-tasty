import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ProductsService } from "./products.service";

describe("ProductsService", () => {
  const prisma = {
    category: {
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("only exposes product detail pages for active products in active categories", async () => {
    prisma.product.findFirst.mockResolvedValue({
      id: "product-1",
      slug: "mordida-smash",
      active: true,
      category: { active: true },
    });

    await expect(
      new ProductsService(prisma as never).getProductBySlug("mordida-smash"),
    ).resolves.toMatchObject({
      id: "product-1",
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
  });

  it("returns not found when the public product lookup is filtered out", async () => {
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(
      new ProductsService(prisma as never).getProductBySlug("hidden"),
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
      new ProductsService(prisma as never).createProduct({
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

    await new ProductsService(prisma as never).createProduct({
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

  it("rejects external image URLs when creating products", async () => {
    prisma.category.findUnique.mockResolvedValue({ id: "category-1" });
    prisma.product.findUnique.mockResolvedValue(null);

    await expect(
      new ProductsService(prisma as never).createProduct({
        categoryId: "category-1",
        description: "Burger",
        imageUrl: "https://example.com/burger.jpg",
        name: "Mordida",
        priceCents: 750,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it("rejects external image URLs when updating products", async () => {
    prisma.product.findUnique.mockResolvedValue({ id: "product-1" });

    await expect(
      new ProductsService(prisma as never).updateProduct("product-1", {
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
      new ProductsService(prisma as never).createOptionGroup("product-1", {
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

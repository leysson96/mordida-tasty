import { NotFoundException } from "@nestjs/common";
import { ProductsService } from "./products.service";

describe("ProductsService", () => {
  const prisma = {
    product: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
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
    product: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
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

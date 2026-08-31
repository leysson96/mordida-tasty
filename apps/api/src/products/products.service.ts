import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCategoryDto, UpdateCategoryDto } from "./dto/category.dto";
import {
  CreateProductOptionChoiceDto,
  CreateProductOptionGroupDto,
  UpdateProductOptionChoiceDto,
  UpdateProductOptionGroupDto,
} from "./dto/product-options.dto";
import {
  CreateProductDto,
  ToggleAvailabilityDto,
  UpdateProductDto,
} from "./dto/product.dto";

const publicOptionGroupsInclude = {
  where: { active: true },
  orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  include: {
    choices: {
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    },
  },
} satisfies Prisma.ProductOptionGroupFindManyArgs;

const adminOptionGroupsInclude = {
  orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  include: {
    choices: {
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    },
  },
} satisfies Prisma.ProductOptionGroupFindManyArgs;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  listMenu() {
    return this.prisma.category.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        products: {
          where: { active: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: {
            optionGroups: publicOptionGroupsInclude,
          },
        },
      },
    });
  }

  async getProductBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        slug,
        active: true,
        category: {
          active: true,
        },
      },
      include: {
        category: true,
        optionGroups: publicOptionGroupsInclude,
      },
    });

    if (!product) {
      throw new NotFoundException("Product not found.");
    }

    return product;
  }

  listAdminProducts() {
    return this.prisma.product.findMany({
      orderBy: [
        { category: { sortOrder: "asc" } },
        { sortOrder: "asc" },
        { name: "asc" },
      ],
      include: {
        category: true,
        optionGroups: adminOptionGroupsInclude,
      },
    });
  }

  listAdminCategories() {
    return this.prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true } } },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    const slug = await this.uniqueCategorySlug(dto.slug ?? dto.name);
    return this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    await this.ensureCategory(id);
    const data: Prisma.CategoryUpdateInput = {
      name: dto.name?.trim(),
      sortOrder: dto.sortOrder,
      active: dto.active,
    };

    if (dto.slug) {
      data.slug = await this.uniqueCategorySlug(dto.slug, id);
    }

    return this.prisma.category.update({
      where: { id },
      data,
    });
  }

  async createProduct(dto: CreateProductDto) {
    await this.ensureCategory(dto.categoryId);
    const slug = await this.uniqueProductSlug(dto.slug ?? dto.name);

    return this.prisma.product.create({
      data: {
        categoryId: dto.categoryId,
        name: dto.name.trim(),
        slug,
        description: dto.description.trim(),
        priceCents: dto.priceCents,
        imageUrl: normalizeImageUrl(dto.imageUrl),
        sortOrder: dto.sortOrder ?? 0,
      },
      include: {
        category: true,
        optionGroups: adminOptionGroupsInclude,
      },
    });
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    await this.ensureProduct(id);

    if (dto.categoryId) {
      await this.ensureCategory(dto.categoryId);
    }

    const data: Prisma.ProductUpdateInput = {
      name: dto.name?.trim(),
      description: dto.description?.trim(),
      priceCents: dto.priceCents,
      imageUrl: normalizeImageUrl(dto.imageUrl),
      active: dto.active,
      available: dto.available,
      sortOrder: dto.sortOrder,
    };

    if (dto.categoryId) {
      data.category = { connect: { id: dto.categoryId } };
    }

    if (dto.slug) {
      data.slug = await this.uniqueProductSlug(dto.slug, id);
    }

    return this.prisma.product.update({
      where: { id },
      data,
      include: {
        category: true,
        optionGroups: adminOptionGroupsInclude,
      },
    });
  }

  async toggleAvailability(id: string, dto: ToggleAvailabilityDto) {
    await this.ensureProduct(id);
    return this.prisma.product.update({
      where: { id },
      data: { available: dto.available },
      include: {
        category: true,
        optionGroups: adminOptionGroupsInclude,
      },
    });
  }

  async deactivateCategory(id: string) {
    await this.ensureCategory(id);
    return this.prisma.category.update({
      where: { id },
      data: { active: false },
      include: { _count: { select: { products: true } } },
    });
  }

  async createOptionGroup(productId: string, dto: CreateProductOptionGroupDto) {
    await this.ensureProduct(productId);
    const bounds = this.normalizeChoiceBounds(
      dto.required ?? false,
      dto.minChoices,
      dto.maxChoices,
    );

    return this.prisma.productOptionGroup.create({
      data: {
        productId,
        name: cleanText(dto.name, "Option group name"),
        required: bounds.required,
        minChoices: bounds.minChoices,
        maxChoices: bounds.maxChoices,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: { choices: true },
    });
  }

  async updateOptionGroup(id: string, dto: UpdateProductOptionGroupDto) {
    const current = await this.ensureOptionGroup(id);
    const data: Prisma.ProductOptionGroupUpdateInput = {
      name:
        dto.name !== undefined
          ? cleanText(dto.name, "Option group name")
          : undefined,
      active: dto.active,
      sortOrder: dto.sortOrder,
    };

    if (
      dto.required !== undefined ||
      dto.minChoices !== undefined ||
      dto.maxChoices !== undefined
    ) {
      const bounds = this.normalizeChoiceBounds(
        dto.required ?? current.required,
        dto.minChoices ?? current.minChoices,
        dto.maxChoices ?? current.maxChoices,
      );
      data.required = bounds.required;
      data.minChoices = bounds.minChoices;
      data.maxChoices = bounds.maxChoices;
    }

    return this.prisma.productOptionGroup.update({
      where: { id },
      data,
      include: {
        choices: {
          orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
        },
      },
    });
  }

  async deactivateOptionGroup(id: string) {
    await this.ensureOptionGroup(id);
    return this.prisma.productOptionGroup.update({
      where: { id },
      data: { active: false },
      include: {
        choices: {
          orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
        },
      },
    });
  }

  async createOptionChoice(groupId: string, dto: CreateProductOptionChoiceDto) {
    await this.ensureOptionGroup(groupId);

    return this.prisma.productOptionChoice.create({
      data: {
        groupId,
        name: cleanText(dto.name, "Option choice name"),
        priceCents: this.normalizeMoney(dto.priceCents ?? 0),
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateOptionChoice(id: string, dto: UpdateProductOptionChoiceDto) {
    await this.ensureOptionChoice(id);

    return this.prisma.productOptionChoice.update({
      where: { id },
      data: {
        name:
          dto.name !== undefined
            ? cleanText(dto.name, "Option choice name")
            : undefined,
        priceCents:
          dto.priceCents !== undefined
            ? this.normalizeMoney(dto.priceCents)
            : undefined,
        active: dto.active,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async deactivateOptionChoice(id: string) {
    await this.ensureOptionChoice(id);
    return this.prisma.productOptionChoice.update({
      where: { id },
      data: { active: false },
    });
  }

  private async ensureCategory(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException("Category not found.");
    }
    return category;
  }

  private async ensureProduct(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException("Product not found.");
    }
    return product;
  }

  private async ensureOptionGroup(id: string) {
    const group = await this.prisma.productOptionGroup.findUnique({
      where: { id },
    });
    if (!group) {
      throw new NotFoundException("Option group not found.");
    }
    return group;
  }

  private async ensureOptionChoice(id: string) {
    const choice = await this.prisma.productOptionChoice.findUnique({
      where: { id },
    });
    if (!choice) {
      throw new NotFoundException("Option choice not found.");
    }
    return choice;
  }

  private normalizeChoiceBounds(
    required: boolean,
    minChoicesInput?: number,
    maxChoicesInput?: number,
  ) {
    const maxChoices = maxChoicesInput ?? 1;
    const minChoices = minChoicesInput ?? (required ? 1 : 0);

    if (!Number.isInteger(minChoices) || minChoices < 0) {
      throw new BadRequestException("Minimum choices must be >= 0.");
    }

    if (!Number.isInteger(maxChoices) || maxChoices < 1) {
      throw new BadRequestException("Maximum choices must be >= 1.");
    }

    const normalizedMinChoices = required
      ? Math.max(1, minChoices)
      : minChoices;

    if (normalizedMinChoices > maxChoices) {
      throw new BadRequestException(
        "Minimum choices cannot be greater than maximum choices.",
      );
    }

    return {
      required,
      minChoices: normalizedMinChoices,
      maxChoices,
    };
  }

  private normalizeMoney(value: number) {
    if (!Number.isInteger(value) || value < 0) {
      throw new BadRequestException("Amount must be an integer >= 0.");
    }

    return value;
  }

  private async uniqueCategorySlug(input: string, excludingId?: string) {
    const base = slugify(input);
    for (let index = 0; index < 50; index += 1) {
      const slug = index === 0 ? base : `${base}-${index + 1}`;
      const found = await this.prisma.category.findUnique({ where: { slug } });
      if (!found || found.id === excludingId) {
        return slug;
      }
    }

    throw new ConflictException("Could not generate a unique category slug.");
  }

  private async uniqueProductSlug(input: string, excludingId?: string) {
    const base = slugify(input);
    for (let index = 0; index < 50; index += 1) {
      const slug = index === 0 ? base : `${base}-${index + 1}`;
      const found = await this.prisma.product.findUnique({ where: { slug } });
      if (!found || found.id === excludingId) {
        return slug;
      }
    }

    throw new ConflictException("Could not generate a unique product slug.");
  }
}

function slugify(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    throw new BadRequestException("Name must contain letters or numbers.");
  }

  return slug;
}

function cleanText(value: string, field: string) {
  const clean = value.trim();
  if (!clean) {
    throw new BadRequestException(`${field} is required.`);
  }

  return clean;
}

function normalizeImageUrl(value?: string) {
  const imageUrl = value?.trim();

  if (!imageUrl) {
    return undefined;
  }

  if (imageUrl.startsWith("/images/") || imageUrl.startsWith("/uploads/")) {
    return imageUrl;
  }

  try {
    const parsed = new URL(imageUrl);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    throw new BadRequestException(
      "Image must be a local path or an http(s) URL.",
    );
  }

  throw new BadRequestException(
    "Image must be a local path or an http(s) URL.",
  );
}

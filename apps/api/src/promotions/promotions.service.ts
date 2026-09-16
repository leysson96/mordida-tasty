import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DiscountScope,
  DiscountType,
  DiscountWeekday,
  Prisma,
} from "@prisma/client";
import { AppEnv } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateAdminDiscountDto,
  UpdateAdminDiscountDto,
} from "./dto/admin-discount.dto";

const discountResolutionInclude = {
  products: {
    select: {
      productId: true,
    },
  },
} satisfies Prisma.DiscountInclude;

const adminDiscountInclude = {
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      active: true,
    },
  },
  products: {
    include: {
      product: {
        select: {
          id: true,
          categoryId: true,
          name: true,
          slug: true,
          priceCents: true,
          active: true,
          available: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              active: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.DiscountInclude;

const publicDiscountCampaignInclude = {
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
} satisfies Prisma.DiscountInclude;

export type DiscountForResolution = Prisma.DiscountGetPayload<{
  include: typeof discountResolutionInclude;
}>;

type AdminDiscountRecord = Prisma.DiscountGetPayload<{
  include: typeof adminDiscountInclude;
}>;

type PublicDiscountCampaignRecord = Prisma.DiscountGetPayload<{
  include: typeof publicDiscountCampaignInclude;
}>;

export type AdminDiscount = ReturnType<typeof toAdminDiscount>;

export type PublicDiscountCampaign = ReturnType<
  typeof toPublicDiscountCampaign
>;

export interface DiscountLookupInput {
  productIds: string[];
  categoryIds: string[];
  now?: Date;
}

export interface LineDiscountInput {
  productId: string;
  categoryId: string;
  unitPriceCents: number;
  quantity: number;
  discounts: DiscountForResolution[];
  now?: Date;
}

export interface ResolvedLineDiscount {
  discountId: string;
  discountName: string;
  discountType: DiscountType;
  discountValue: number;
  priority: number;
  originalUnitPriceCents: number;
  discountedUnitPriceCents: number;
  unitDiscountCents: number;
  quantity: number;
  originalLineTotalCents: number;
  lineDiscountCents: number;
  lineTotalCents: number;
}

@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppEnv, true>,
  ) {}

  async listAdminDiscounts() {
    const discounts = await this.prisma.discount.findMany({
      orderBy: [
        { active: "desc" },
        { priority: "desc" },
        { startsAt: "desc" },
        { createdAt: "desc" },
      ],
      include: adminDiscountInclude,
    });

    return discounts.map((discount) =>
      toAdminDiscount(discount, this.appTimezone()),
    );
  }

  async createAdminDiscount(input: CreateAdminDiscountDto) {
    const data = await this.normalizeAdminDiscountInput(input);
    const discount = (await this.prisma.discount.create({
      data: {
        name: data.name,
        description: data.description,
        active: data.active,
        type: data.type,
        value: data.value,
        scope: data.scope,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        weekdays: data.weekdays,
        stackable: false,
        priority: data.priority,
        categoryId: data.categoryId,
        products:
          data.scope === DiscountScope.PRODUCTS
            ? {
                create: data.productIds.map((productId) => ({ productId })),
              }
            : undefined,
      },
      include: adminDiscountInclude,
    })) as AdminDiscountRecord;

    return toAdminDiscount(discount, this.appTimezone());
  }

  async updateAdminDiscount(id: string, input: UpdateAdminDiscountDto) {
    const current = await this.findAdminDiscountOrThrow(id);
    const data = await this.normalizeAdminDiscountInput(input, current);

    const discount = await this.prisma.$transaction(async (tx) => {
      if (data.scope !== DiscountScope.PRODUCTS || input.productIds) {
        await tx.discountProduct.deleteMany({
          where: { discountId: current.id },
        });
      }

      if (data.scope === DiscountScope.PRODUCTS && input.productIds) {
        await tx.discountProduct.createMany({
          data: data.productIds.map((productId) => ({
            discountId: current.id,
            productId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.discount.update({
        where: { id: current.id },
        data: {
          name: data.name,
          description: data.description,
          active: data.active,
          type: data.type,
          value: data.value,
          scope: data.scope,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          weekdays: data.weekdays,
          stackable: false,
          priority: data.priority,
          categoryId: data.categoryId,
        },
        include: adminDiscountInclude,
      });
    });

    return toAdminDiscount(discount, this.appTimezone());
  }

  async deactivateAdminDiscount(id: string) {
    await this.findAdminDiscountOrThrow(id);
    const discount = await this.prisma.discount.update({
      where: { id },
      data: { active: false },
      include: adminDiscountInclude,
    });

    return toAdminDiscount(discount, this.appTimezone());
  }

  async listPublicDiscountCampaigns(now = new Date()) {
    const discounts = await this.prisma.discount.findMany({
      where: {
        active: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
        scope: {
          in: [DiscountScope.PRODUCTS, DiscountScope.CATEGORY],
        },
      },
      include: publicDiscountCampaignInclude,
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });

    return discounts.map((discount) =>
      toPublicDiscountCampaign(discount, this.appTimezone()),
    );
  }

  listActiveDiscountsForCheckout(input: DiscountLookupInput) {
    const now = input.now ?? new Date();
    const productIds = uniqueCleanIds(input.productIds);
    const categoryIds = uniqueCleanIds(input.categoryIds);

    if (productIds.length === 0 && categoryIds.length === 0) {
      return Promise.resolve([]);
    }

    const scopeFilters: Prisma.DiscountWhereInput[] = [
      { scope: DiscountScope.ORDER_TOTAL },
    ];

    if (productIds.length > 0) {
      scopeFilters.push({
        scope: DiscountScope.PRODUCTS,
        products: {
          some: {
            productId: { in: productIds },
          },
        },
      });
    }

    if (categoryIds.length > 0) {
      scopeFilters.push({
        scope: DiscountScope.CATEGORY,
        categoryId: { in: categoryIds },
      });
    }

    return this.prisma.discount.findMany({
      where: {
        active: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
        OR: scopeFilters,
      },
      include: discountResolutionInclude,
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
  }

  resolveLineDiscount(
    input: LineDiscountInput,
  ): ResolvedLineDiscount | undefined {
    this.assertPositiveInteger(input.unitPriceCents, "Unit price");
    this.assertPositiveInteger(input.quantity, "Quantity");

    const now = input.now ?? new Date();
    const candidates = input.discounts
      .filter((discount) => this.appliesToLine(discount, input, now))
      .map((discount) => this.calculateLineDiscount(discount, input))
      .filter((discount) => discount.lineDiscountCents > 0)
      .sort(compareResolvedLineDiscounts);

    return candidates[0];
  }

  private appliesToLine(
    discount: DiscountForResolution,
    input: LineDiscountInput,
    now: Date,
  ) {
    return (
      discount.active &&
      discount.startsAt <= now &&
      discount.endsAt >= now &&
      this.isValidWeekday(discount.weekdays, now) &&
      this.targetsLine(discount, input)
    );
  }

  private targetsLine(
    discount: DiscountForResolution,
    input: Pick<LineDiscountInput, "productId" | "categoryId">,
  ) {
    if (discount.scope === DiscountScope.PRODUCTS) {
      return discount.products.some(
        (product) => product.productId === input.productId,
      );
    }

    if (discount.scope === DiscountScope.CATEGORY) {
      return discount.categoryId === input.categoryId;
    }

    return false;
  }

  private isValidWeekday(weekdays: DiscountWeekday[], now: Date) {
    if (weekdays.length === 0) {
      return true;
    }

    return weekdays.includes(weekdayInTimezone(now, this.appTimezone()));
  }

  private calculateLineDiscount(
    discount: DiscountForResolution,
    input: Pick<LineDiscountInput, "unitPriceCents" | "quantity">,
  ): ResolvedLineDiscount {
    this.assertValidDiscountValue(discount);

    const unitDiscountCents =
      discount.type === DiscountType.PERCENTAGE
        ? Math.round((input.unitPriceCents * discount.value) / 10_000)
        : discount.value;
    const cappedUnitDiscountCents = Math.min(
      input.unitPriceCents,
      unitDiscountCents,
    );
    const discountedUnitPriceCents =
      input.unitPriceCents - cappedUnitDiscountCents;
    const originalLineTotalCents = input.unitPriceCents * input.quantity;
    const lineDiscountCents = cappedUnitDiscountCents * input.quantity;

    return {
      discountId: discount.id,
      discountName: discount.name,
      discountType: discount.type,
      discountValue: discount.value,
      priority: discount.priority,
      originalUnitPriceCents: input.unitPriceCents,
      discountedUnitPriceCents,
      unitDiscountCents: cappedUnitDiscountCents,
      quantity: input.quantity,
      originalLineTotalCents,
      lineDiscountCents,
      lineTotalCents: originalLineTotalCents - lineDiscountCents,
    };
  }

  private assertValidDiscountValue(discount: DiscountForResolution) {
    this.assertPositiveInteger(discount.value, "Discount value");

    if (
      discount.type === DiscountType.PERCENTAGE &&
      discount.value > 10_000
    ) {
      throw new BadRequestException(
        "Percentage discounts must be <= 10000 basis points.",
      );
    }
  }

  private assertPositiveInteger(value: number, field: string) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException(`${field} must be a positive integer.`);
    }
  }

  private async findAdminDiscountOrThrow(id: string) {
    const discount = await this.prisma.discount.findUnique({
      where: { id },
      include: adminDiscountInclude,
    });

    if (!discount) {
      throw new NotFoundException("Discount not found.");
    }

    return discount;
  }

  private async normalizeAdminDiscountInput(
    input: CreateAdminDiscountDto | UpdateAdminDiscountDto,
    current?: AdminDiscountRecord,
  ) {
    const scope = input.scope ?? current?.scope;

    if (!scope) {
      throw new BadRequestException("Discount scope is required.");
    }

    if (scope === DiscountScope.ORDER_TOTAL) {
      throw new BadRequestException(
        "Order-total discounts are not available in the admin yet.",
      );
    }

    const type = input.type ?? current?.type;
    if (!type) {
      throw new BadRequestException("Discount type is required.");
    }

    const value = input.value ?? current?.value;
    if (value === undefined) {
      throw new BadRequestException("Discount value is required.");
    }
    this.assertValidAdminDiscountValue(type, value);

    const startsAt = input.startsOn
      ? zonedBusinessDateStart(input.startsOn, this.appTimezone())
      : current?.startsAt;
    const endsAt = input.endsOn
      ? zonedBusinessDateEnd(input.endsOn, this.appTimezone())
      : current?.endsAt;

    if (!startsAt || !endsAt) {
      throw new BadRequestException("Discount date range is required.");
    }

    if (endsAt < startsAt) {
      throw new BadRequestException(
        "Discount end date must be equal to or later than the start date.",
      );
    }

    const productIds = await this.resolveAdminProductIds(input, current, scope);
    const categoryId = await this.resolveAdminCategoryId(input, current, scope);

    return {
      name:
        input.name !== undefined
          ? cleanRequiredText(input.name, "Discount name")
          : cleanRequiredText(current?.name ?? "", "Discount name"),
      description:
        input.description !== undefined
          ? cleanOptionalText(input.description)
          : current?.description ?? null,
      active: input.active ?? current?.active ?? false,
      type,
      value,
      scope,
      startsAt,
      endsAt,
      weekdays: uniqueWeekdays(input.weekdays ?? current?.weekdays ?? []),
      priority: this.normalizePriority(input.priority ?? current?.priority ?? 0),
      categoryId,
      productIds,
    };
  }

  private async resolveAdminProductIds(
    input: CreateAdminDiscountDto | UpdateAdminDiscountDto,
    current: AdminDiscountRecord | undefined,
    scope: DiscountScope,
  ) {
    if (scope !== DiscountScope.PRODUCTS) {
      return [];
    }

    const productIds =
      input.productIds !== undefined
        ? uniqueCleanIds(input.productIds)
        : (current?.products.map((link) => link.productId) ?? []);

    if (productIds.length === 0) {
      throw new BadRequestException(
        "At least one product is required for product discounts.",
      );
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    const foundIds = new Set(products.map((product) => product.id));
    const missingIds = productIds.filter((productId) => !foundIds.has(productId));

    if (missingIds.length > 0) {
      throw new BadRequestException("Some selected products do not exist.");
    }

    return productIds;
  }

  private async resolveAdminCategoryId(
    input: CreateAdminDiscountDto | UpdateAdminDiscountDto,
    current: AdminDiscountRecord | undefined,
    scope: DiscountScope,
  ) {
    if (scope !== DiscountScope.CATEGORY) {
      return null;
    }

    const categoryId = input.categoryId ?? current?.categoryId ?? undefined;
    if (!categoryId) {
      throw new BadRequestException(
        "A category is required for category discounts.",
      );
    }

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });

    if (!category) {
      throw new BadRequestException("Selected category does not exist.");
    }

    return category.id;
  }

  private assertValidAdminDiscountValue(
    type: DiscountType,
    value: number | undefined,
  ) {
    this.assertPositiveInteger(value ?? 0, "Discount value");

    if (type === DiscountType.PERCENTAGE && (value ?? 0) > 10_000) {
      throw new BadRequestException(
        "Percentage discounts must be <= 10000 basis points.",
      );
    }
  }

  private normalizePriority(value: number) {
    if (!Number.isInteger(value) || value < 0 || value > 10_000) {
      throw new BadRequestException(
        "Discount priority must be an integer between 0 and 10000.",
      );
    }

    return value;
  }

  private appTimezone() {
    return this.configService.get("APP_TIMEZONE", { infer: true });
  }
}

function toAdminDiscount(discount: AdminDiscountRecord, timezone: string) {
  return {
    ...discount,
    startsOn: dateOnlyInTimezone(discount.startsAt, timezone),
    endsOn: dateOnlyInTimezone(discount.endsAt, timezone),
    productIds: discount.products.map((link) => link.productId),
    products: discount.products.map((link) => link.product),
  };
}

function toPublicDiscountCampaign(
  discount: PublicDiscountCampaignRecord,
  timezone: string,
) {
  return {
    id: discount.id,
    name: discount.name,
    description: discount.description,
    active: discount.active,
    type: discount.type,
    value: discount.value,
    scope: discount.scope,
    startsOn: dateOnlyInTimezone(discount.startsAt, timezone),
    endsOn: dateOnlyInTimezone(discount.endsAt, timezone),
    weekdays: discount.weekdays,
    priority: discount.priority,
    categoryId: discount.categoryId,
    category: discount.category,
    productIds: discount.products.map((link) => link.productId),
  };
}

function compareResolvedLineDiscounts(
  left: ResolvedLineDiscount,
  right: ResolvedLineDiscount,
) {
  return (
    right.priority - left.priority ||
    right.lineDiscountCents - left.lineDiscountCents ||
    left.discountId.localeCompare(right.discountId)
  );
}

function uniqueCleanIds(values: string[]) {
  return [
    ...new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  ];
}

function uniqueWeekdays(values: DiscountWeekday[]) {
  return [...new Set(values)];
}

function cleanRequiredText(value: string, field: string) {
  const clean = value.trim();
  if (!clean) {
    throw new BadRequestException(`${field} is required.`);
  }

  return clean;
}

function cleanOptionalText(value: string | undefined) {
  const clean = value?.trim() ?? "";
  return clean.length > 0 ? clean : null;
}

function zonedBusinessDateStart(dateOnly: string, timezone: string) {
  const date = parseDateOnly(dateOnly);
  return zonedDateTimeToUtc(date, { hour: 0, minute: 0, second: 0, ms: 0 }, timezone);
}

function zonedBusinessDateEnd(dateOnly: string, timezone: string) {
  const date = parseDateOnly(dateOnly);
  return zonedDateTimeToUtc(
    date,
    { hour: 23, minute: 59, second: 59, ms: 999 },
    timezone,
  );
}

function parseDateOnly(dateOnly: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) {
    throw new BadRequestException("Date must use YYYY-MM-DD format.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new BadRequestException("Date is invalid.");
  }

  return { year, month, day };
}

function zonedDateTimeToUtc(
  date: { year: number; month: number; day: number },
  time: { hour: number; minute: number; second: number; ms: number },
  timezone: string,
) {
  const localAsUtcMs = Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    time.hour,
    time.minute,
    time.second,
    time.ms,
  );
  const firstPass = new Date(
    localAsUtcMs - timezoneOffsetMs(new Date(localAsUtcMs), timezone),
  );
  return new Date(localAsUtcMs - timezoneOffsetMs(firstPass, timezone));
}

function timezoneOffsetMs(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
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
  const localAsUtcMs = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second"),
  );

  return localAsUtcMs - Math.floor(date.getTime() / 1000) * 1000;
}

function dateOnlyInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: timezone,
  }).formatToParts(date);

  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";

  return `${year}-${month}-${day}`;
}

function weekdayInTimezone(date: Date, timezone: string) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: timezone,
  }).format(date);

  switch (weekday) {
    case "Mon":
      return DiscountWeekday.MON;
    case "Tue":
      return DiscountWeekday.TUE;
    case "Wed":
      return DiscountWeekday.WED;
    case "Thu":
      return DiscountWeekday.THU;
    case "Fri":
      return DiscountWeekday.FRI;
    case "Sat":
      return DiscountWeekday.SAT;
    case "Sun":
      return DiscountWeekday.SUN;
    default:
      throw new BadRequestException("Could not resolve discount weekday.");
  }
}

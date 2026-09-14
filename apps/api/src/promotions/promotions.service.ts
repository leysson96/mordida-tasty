import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DiscountScope,
  DiscountType,
  DiscountWeekday,
  Prisma,
} from "@prisma/client";
import { AppEnv } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";

const discountResolutionInclude = {
  products: {
    select: {
      productId: true,
    },
  },
} satisfies Prisma.DiscountInclude;

export type DiscountForResolution = Prisma.DiscountGetPayload<{
  include: typeof discountResolutionInclude;
}>;

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

  private appTimezone() {
    return this.configService.get("APP_TIMEZONE", { infer: true });
  }
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

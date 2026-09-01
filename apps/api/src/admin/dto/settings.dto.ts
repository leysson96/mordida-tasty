import {
  ArrayMinSize,
  IsBoolean,
  IsArray,
  IsIn,
  IsISO8601,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateTaxRateDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  taxRate!: number;
}

export class UpdateOpeningHoursDto {
  @IsObject()
  openingHours!: {
    timezone: string;
    weekly: Record<string, Array<{ open: string; close: string }>>;
  };
}

export class UpdateDeliveryFeeDto {
  @IsInt()
  @Min(0)
  deliveryFeeCents!: number;
}

export class UpdateOrdersPauseDto {
  @IsBoolean()
  paused!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  reason?: string;
}

export class UpdateLoyaltyProgramDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(20)
  goalOrders?: number;

  @IsOptional()
  @IsIn(["DISCOUNT_PERCENT", "FREE_PRODUCT"])
  rewardType?: "DISCOUNT_PERCENT" | "FREE_PRODUCT";

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  freeProductName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  description?: string;
}

export class CreateSpecialClosureDto {
  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  endsAt!: string;

  @IsString()
  @MaxLength(180)
  reason!: string;
}

export class UpdateSpecialClosureDto {
  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  reason?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateDeliveryZoneDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  postalCodes!: string[];

  @IsInt()
  @Min(0)
  deliveryFeeCents!: number;

  @IsInt()
  @Min(0)
  minimumOrderCents!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateDeliveryZoneDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  postalCodes?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  deliveryFeeCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumOrderCents?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateSiteContentDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  initials?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  tagline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  heroTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(480)
  heroText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(700)
  heroImage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(130)
  featuredProductSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  featuredProductName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(260)
  menuIntroText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  fontFamily?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  instagramUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  whatsappPhone?: string;
}

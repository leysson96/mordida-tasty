import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import {
  DiscountScope,
  DiscountType,
  DiscountWeekday,
} from "@prisma/client";

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

export class CreateAdminDiscountDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(260)
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsEnum(DiscountType)
  type!: DiscountType;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  value!: number;

  @IsEnum(DiscountScope)
  scope!: DiscountScope;

  @IsString()
  @Matches(dateOnlyPattern)
  startsOn!: string;

  @IsString()
  @Matches(dateOnlyPattern)
  endsOn!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsEnum(DiscountWeekday, { each: true })
  weekdays?: DiscountWeekday[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  priority?: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true })
  productIds?: string[];
}

export class UpdateAdminDiscountDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(260)
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsEnum(DiscountType)
  type?: DiscountType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  value?: number;

  @IsOptional()
  @IsEnum(DiscountScope)
  scope?: DiscountScope;

  @IsOptional()
  @IsString()
  @Matches(dateOnlyPattern)
  startsOn?: string;

  @IsOptional()
  @IsString()
  @Matches(dateOnlyPattern)
  endsOn?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsEnum(DiscountWeekday, { each: true })
  weekdays?: DiscountWeekday[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  priority?: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true })
  productIds?: string[];
}

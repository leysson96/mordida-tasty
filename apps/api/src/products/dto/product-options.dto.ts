import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateProductOptionGroupDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  minChoices?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxChoices?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateProductOptionGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  minChoices?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxChoices?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateProductOptionChoiceDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateProductOptionChoiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

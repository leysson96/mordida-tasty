import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  categoryId!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(130)
  slug?: string;

  @IsString()
  @MaxLength(600)
  description!: string;

  @IsInt()
  @Min(1)
  priceCents!: number;

  @IsOptional()
  @IsString()
  @MaxLength(700)
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(130)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  priceCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(700)
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  available?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ToggleAvailabilityDto {
  @IsBoolean()
  available!: boolean;
}

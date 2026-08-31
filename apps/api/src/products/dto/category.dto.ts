import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(90)
  slug?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(90)
  slug?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

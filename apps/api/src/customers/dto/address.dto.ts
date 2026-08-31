import { IsBoolean, IsOptional, IsPhoneNumber, IsString, MaxLength, MinLength } from 'class-validator';

export class UpsertAddressDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  label!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  recipientName!: string;

  @IsPhoneNumber('ES')
  phone!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(180)
  street!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(12)
  postalCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

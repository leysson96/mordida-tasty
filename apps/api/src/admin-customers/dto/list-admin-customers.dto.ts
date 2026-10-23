import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export enum CustomerAccountStatus {
  ALL = "ALL",
  ACTIVE = "ACTIVE",
  DISABLED = "DISABLED",
}

export enum CustomerListSource {
  REGISTERED = "REGISTERED",
  GUEST = "GUEST",
}

export enum CustomerSortField {
  CREATED_AT = "CREATED_AT",
  NAME = "NAME",
  LAST_LOGIN_AT = "LAST_LOGIN_AT",
}

export enum SortDirection {
  ASC = "ASC",
  DESC = "DESC",
}

export class ListAdminCustomersDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsEnum(CustomerAccountStatus)
  status: CustomerAccountStatus = CustomerAccountStatus.ALL;

  @IsOptional()
  @IsEnum(CustomerListSource)
  source?: CustomerListSource = CustomerListSource.REGISTERED;

  @IsOptional()
  @IsEnum(CustomerSortField)
  sortBy: CustomerSortField = CustomerSortField.CREATED_AT;

  @IsOptional()
  @IsEnum(SortDirection)
  sortDirection: SortDirection = SortDirection.DESC;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;
}

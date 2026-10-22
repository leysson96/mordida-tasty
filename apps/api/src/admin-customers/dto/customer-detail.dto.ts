import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export enum CustomerSegmentKey {
  NEW = "NEW",
  DEVELOPING = "DEVELOPING",
  ACTIVE = "ACTIVE",
  FREQUENT = "FREQUENT",
  INACTIVE = "INACTIVE",
}

export class CustomerHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 10;
}

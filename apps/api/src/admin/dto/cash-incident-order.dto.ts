import { CashTrustIncidentReason } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class CancelCashIncidentOrderDto {
  @IsEnum(CashTrustIncidentReason)
  reason!: CashTrustIncidentReason;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}

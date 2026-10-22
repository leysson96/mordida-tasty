import { CommercialConsentChannel } from "@prisma/client";
import { ArrayUnique, IsArray, IsEnum } from "class-validator";

export class UpdateCommercialConsentsDto {
  @IsArray()
  @ArrayUnique()
  @IsEnum(CommercialConsentChannel, { each: true })
  channels!: CommercialConsentChannel[];
}

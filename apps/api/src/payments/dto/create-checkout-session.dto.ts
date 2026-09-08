import { IsString, IsUUID, MinLength } from "class-validator";

export class CreateCheckoutSessionDto {
  @IsUUID()
  orderId!: string;

  @IsString()
  @MinLength(20)
  trackingToken!: string;
}

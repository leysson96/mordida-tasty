import { IsUUID } from 'class-validator';

export class CreateCheckoutSessionDto {
  @IsUUID()
  orderId!: string;
}

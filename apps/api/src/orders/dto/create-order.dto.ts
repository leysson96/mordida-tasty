import { Type } from "class-transformer";
import {
  ArrayMinSize,
  ArrayMaxSize,
  Equals,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  MaxLength,
  Max,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { DeliveryMethod, OrderPaymentMethod } from "@prisma/client";

export class CreateOrderItemOptionDto {
  @IsUUID()
  groupId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID(undefined, { each: true })
  choiceIds!: string[];
}

export class CreateOrderItemDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemOptionDto)
  options?: CreateOrderItemOptionDto[];

  @IsInt()
  @Min(1)
  @Max(25)
  quantity!: number;
}

export class CheckoutAddressDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsPhoneNumber("ES")
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
}

export class CreateOrderDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  customerName!: string;

  @IsEmail()
  customerEmail!: string;

  @IsPhoneNumber("ES")
  customerPhone!: string;

  @IsEnum(DeliveryMethod)
  deliveryMethod!: DeliveryMethod;

  @IsOptional()
  @IsEnum(OrderPaymentMethod)
  paymentMethod?: OrderPaymentMethod;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  cashTenderedCents?: number;

  @ValidateIf(
    (value: CreateOrderDto) => value.deliveryMethod === DeliveryMethod.DELIVERY,
  )
  @ValidateNested()
  @Type(() => CheckoutAddressDto)
  address?: CheckoutAddressDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @Equals(true)
  acceptLegal!: boolean;
}

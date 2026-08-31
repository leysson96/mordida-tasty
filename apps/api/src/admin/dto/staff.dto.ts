import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { Role } from "@prisma/client";

const staffRoles = [Role.ADMIN, Role.KITCHEN] as const;
type StaffRole = (typeof staffRoles)[number];

export class CreateStaffUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsPhoneNumber("ES")
  phone?: string;

  @IsIn(staffRoles)
  role!: StaffRole;

  @IsString()
  @MinLength(10)
  @MaxLength(120)
  @Matches(/[A-Z]/, { message: "password must contain an uppercase letter" })
  @Matches(/[a-z]/, { message: "password must contain a lowercase letter" })
  @Matches(/[0-9]/, { message: "password must contain a number" })
  password!: string;
}

export class UpdateStaffUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsPhoneNumber("ES")
  phone?: string;

  @IsOptional()
  @IsIn(staffRoles)
  role?: StaffRole;
}

export class UpdateStaffStatusDto {
  @IsBoolean()
  active!: boolean;
}

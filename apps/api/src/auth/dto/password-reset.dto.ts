import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RequestPasswordResetDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(120)
  password!: string;
}

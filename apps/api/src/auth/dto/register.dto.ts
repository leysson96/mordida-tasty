import {
  Equals,
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Matches,
  MaxLength,
  MinLength
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(120)
  @Matches(/[A-Z]/, { message: 'password must contain an uppercase letter' })
  @Matches(/[a-z]/, { message: 'password must contain a lowercase letter' })
  @Matches(/[0-9]/, { message: 'password must contain a number' })
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsPhoneNumber('ES')
  phone?: string;

  @Equals(true)
  acceptLegal!: boolean;
}

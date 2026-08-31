import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class DataDeletionRequestDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

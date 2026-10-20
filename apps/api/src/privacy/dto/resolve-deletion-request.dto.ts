import { IsIn, IsString, MaxLength, MinLength } from "class-validator";

export class ResolveDeletionRequestDto {
  @IsIn(["ANONYMIZE", "REJECT"])
  decision!: "ANONYMIZE" | "REJECT";

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  note!: string;
}

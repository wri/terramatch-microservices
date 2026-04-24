import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import { IsBoolean, IsString } from "class-validator";

@JsonApiDto({ type: "passwordResets" })
export class ResetPasswordResponseDto {
  @ApiProperty({
    description: "User email",
    example: "user@example.com",
    required: false
  })
  @IsString()
  emailAddress?: string;

  @ApiProperty({
    description: "Token used",
    example: true,
    required: false
  })
  @IsBoolean()
  tokenUsed?: boolean;

  @ApiProperty({
    description: "Locale",
    example: "en",
    required: false
  })
  @IsString()
  locale?: string;
}

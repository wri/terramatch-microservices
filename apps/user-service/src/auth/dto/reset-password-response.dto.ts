import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";

@JsonApiDto({ type: "passwordResets", id: "uuid" })
export class ResetPasswordResponseDto {
  @ApiProperty({
    description: "User email",
    example: "user@example.com"
  })
  emailAddress: string;
}

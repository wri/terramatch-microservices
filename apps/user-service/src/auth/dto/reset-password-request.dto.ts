import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { JsonApiAttributes } from "@terramatch-microservices/common/dto/json-api-attributes";


@JsonApiDto({ type: "logins", id: "number" })
export class RequestResetPasswordDto extends JsonApiAttributes<RequestResetPasswordDto> {
  @ApiProperty({
    description: "User email",
    example: "user@example.com"
  })
  emailAddress: string;

  @ApiProperty({
    description: "Url to redirect the user to after the password reset is completed",
    example: "www.terramatch.com"
  })
  callbackUrl: string;
}

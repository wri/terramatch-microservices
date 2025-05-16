import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";

@JsonApiDto({ type: "logins" })
export class LoginDto {
  @ApiProperty({
    description: "JWT token for use in future authenticated requests to the API.",
    example: "<jwt token>"
  })
  token: string;
}

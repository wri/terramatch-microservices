import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { JsonApiAttributes } from "@terramatch-microservices/common/dto/json-api-attributes";

@JsonApiDto({ type: "logins", id: "number" })
export class LoginDto extends JsonApiAttributes<LoginDto> {
  @ApiProperty({
    description: "JWT token for use in future authenticated requests to the API.",
    example: "<jwt token>"
  })
  token: string;
}

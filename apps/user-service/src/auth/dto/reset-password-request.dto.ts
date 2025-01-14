import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { JsonApiAttributes } from "@terramatch-microservices/common/dto/json-api-attributes";


@JsonApiDto({ type: 'logins', id: 'number' })
export class RequestResetPasswordDto extends JsonApiAttributes<RequestResetPasswordDto> {
  @ApiProperty({
    description:
      'User email',
    example: 'user@example.com',
  })
  emailAddress: string;
}

import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { JsonApiAttributes } from "@terramatch-microservices/common/dto/json-api-attributes";

@JsonApiDto({ type: 'passwordResets', id: 'number' })
export class ResetPasswordResponseDto extends JsonApiAttributes<ResetPasswordResponseDto> {

  @ApiProperty({
    description:
      'User email',
    example: 'user@example.com',
  })
  emailAddress: string;
}

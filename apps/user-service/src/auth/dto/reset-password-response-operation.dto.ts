import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { JsonApiAttributes } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";

@JsonApiDto({ type: 'logins', id: 'number' })
export class ResetPasswordResponseOperationDto extends JsonApiAttributes<ResetPasswordResponseOperationDto> {
  @ApiProperty({
    description:
      'User email',
    example: 'user@example.com',
  })
  message: string;
}

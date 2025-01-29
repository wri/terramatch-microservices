import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { JsonApiAttributes } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";

@JsonApiDto({ type: 'logins', id: 'number' })
export class ResetPasswordResponseOperationDto extends JsonApiAttributes<ResetPasswordResponseOperationDto> {
  @ApiProperty({
    description: 'Message indicating the result of the password reset operation',
    example: 'Password successfully reset',
  })
  message: string;

  @ApiProperty({
    description: 'User Id',
    example: '12345',
  })
  userId: number;
}

import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { JsonApiAttributes } from "@terramatch-microservices/common/dto/json-api-attributes";

@JsonApiDto({ type: 'logins', id: 'number' })
export class ResetPasswordResponseDto extends JsonApiAttributes<ResetPasswordResponseDto> {
  @ApiProperty({
    description: 'User id',
    example: 'ac905c37-025c-4548-9851-f749ed15b5e1'
  })
  uuid: string;

  @ApiProperty({
    description:
      'User email',
    example: 'user@example.com',
  })
  emailAddress: string;

  @ApiProperty({
    description: 'User Id',
    example: '12345',
  })
  userId: number;
}

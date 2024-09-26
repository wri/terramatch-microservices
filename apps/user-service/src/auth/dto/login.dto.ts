import { ApiProperty } from '@nestjs/swagger';
import { JsonApiDataDto } from '@terramatch-microservices/common/interfaces';

export class LoginDto implements JsonApiDataDto {
  @ApiProperty({ example: 'logins' })
  type: string;

  @ApiProperty({ description: 'The ID of the user associated with this login', example: '1234' })
  id: string;

  @ApiProperty({ description: 'JWT token for use in future authenticated requests to the API.', example: '<jwt token>' })
  token: string;
}

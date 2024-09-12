import { ApiProperty } from '@nestjs/swagger';

export class LoginResponse {
  @ApiProperty({ description: 'JWT token for use in future authenticated requests to the API.' })
  token: string;
}

import { ApiProperty } from '@nestjs/swagger';

export class Login {
  @ApiProperty({ description: 'JWT token for use in future authenticated requests to the API.' })
  token: string;
}

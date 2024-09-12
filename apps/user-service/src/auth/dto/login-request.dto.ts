import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginRequest {
  @IsEmail()
  @ApiProperty()
  email_address: string;

  @IsNotEmpty()
  @ApiProperty()
  password: string;
}

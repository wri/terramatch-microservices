import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @IsEmail()
  @ApiProperty()
  email_address: string;

  @IsNotEmpty()
  @ApiProperty()
  password: string;
}

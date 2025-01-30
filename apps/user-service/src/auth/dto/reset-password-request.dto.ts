import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty } from "class-validator";


export class ResetPasswordRequest {
  @IsEmail()
  @ApiProperty()
  emailAddress: string;

  @IsNotEmpty()
  @ApiProperty()
  callbackUrl: string;
}

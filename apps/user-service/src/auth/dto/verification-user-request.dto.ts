import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional, IsUrl } from "class-validator";

export class VerificationUserRequest {
  @IsNotEmpty()
  @ApiProperty()
  token: string;
}

export class ResendVerificationRequest {
  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({ description: "User email address to resend verification to" })
  emailAddress: string;

  @IsOptional()
  @IsUrl()
  @ApiProperty({
    required: false,
    description: "Optional callback URL used as prefix for the verification token link"
  })
  callbackUrl?: string;
}

import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional, IsUrl } from "class-validator";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

export class VerificationUserRequest {
  @IsNotEmpty()
  @ApiProperty()
  token: string;
}

export class ResendVerificationAttributes {
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

export class ResendVerificationBody extends JsonApiBodyDto(
  class ResendVerificationData extends CreateDataDto("verifications", ResendVerificationAttributes) {}
) {}

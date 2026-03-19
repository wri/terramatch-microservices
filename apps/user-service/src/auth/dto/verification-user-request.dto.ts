import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

export class VerificationUserAttributes {
  @IsNotEmpty()
  @ApiProperty()
  token: string;
}

export class VerificationUserBody extends JsonApiBodyDto(
  class VerificationUserData extends CreateDataDto("verifications", VerificationUserAttributes) {}
) {}

export class ResendVerificationAttributes {
  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  @ApiProperty({ description: "User email address to resend verification to" })
  emailAddress: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  @ApiProperty({
    required: false,
    description: "Optional callback URL used as prefix for the verification token link"
  })
  callbackUrl?: string;
}

export class ResendVerificationBody extends JsonApiBodyDto(
  class ResendVerificationData extends CreateDataDto("verifications", ResendVerificationAttributes) {}
) {}

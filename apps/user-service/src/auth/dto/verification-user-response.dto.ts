import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

@JsonApiDto({ type: "verifications", id: "uuid" })
export class VerificationUserResponseDto {
  @ApiProperty()
  verified: boolean;
}

@JsonApiDto({ type: "resendVerifications", id: "uuid" })
export class ResendVerificationResponseDto {
  @ApiProperty({
    description: "Email address the verification was (or would have been) sent to"
  })
  emailAddress: string;
}

@JsonApiDto({ type: "sendLoginDetails" })
export class SendLoginDetailsResponseDto {
  @ApiProperty({
    description: "Whether the login details were sent successfully"
  })
  @IsBoolean()
  success: boolean;
}

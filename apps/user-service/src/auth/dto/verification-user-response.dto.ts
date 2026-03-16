import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";

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

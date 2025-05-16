import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";

@JsonApiDto({ type: "verifications", id: "uuid" })
export class VerificationUserResponseDto {
  @ApiProperty()
  verified: boolean;
}

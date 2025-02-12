import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { JsonApiAttributes } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";

@JsonApiDto({ type: "verifications", id: "uuid" })
export class VerificationUserResponse extends JsonApiAttributes<VerificationUserResponse> {
  @ApiProperty()
  verified: boolean;
}

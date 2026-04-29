import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { IsEmail, IsNotEmpty } from "class-validator";

@JsonApiDto({ type: "sendLoginDetails" })
export class SendLoginDetailsAttributes {
  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({
    description: "Email address of the user to send login details to"
  })
  emailAddress: string;
}

export class SendLoginDetailsRequestDto extends JsonApiBodyDto(
  class SendLoginDetailsRequestData extends CreateDataDto("sendLoginDetails", SendLoginDetailsAttributes) {}
) {}

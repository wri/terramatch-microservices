import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";

export class OrganisationInviteParamDto extends SingleResourceDto {
  @IsIn(["organisations"])
  @ApiProperty({
    description: "The model type (organisations only for invite)",
    enum: ["organisations"]
  })
  model: "organisations";
}

import { ApiProperty } from "@nestjs/swagger";
import { IsOptional } from "class-validator";
import { TransformBooleanString } from "@terramatch-microservices/common/decorators/transform-boolean-string.decorator";

export class UserAssociationQueryDto {
  @ApiProperty({
    description: "Flag to filter by manager",
    required: false
  })
  @IsOptional()
  @TransformBooleanString()
  isManager?: boolean;
}

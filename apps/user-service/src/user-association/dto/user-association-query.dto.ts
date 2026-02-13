import { ApiProperty } from "@nestjs/swagger";
import { IndexQueryDto } from "@terramatch-microservices/common/dto/index-query.dto";
import { IsOptional } from "class-validator";
import { TransformBooleanString } from "@terramatch-microservices/common/decorators/transform-boolean-string.decorator";

export class UserAssociationQueryDto extends IndexQueryDto {
  @ApiProperty({
    description: "Flag to filter by manager",
    required: false
  })
  @IsOptional()
  @TransformBooleanString()
  isManager?: boolean;
}

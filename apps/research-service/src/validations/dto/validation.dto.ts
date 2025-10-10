import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ValidationCriteriaDto } from "./validation-criteria.dto";

@JsonApiDto({ type: "validations" })
export class ValidationDto {
  @ApiProperty({
    description: "The UUID of the polygon that was validated",
    example: "d6502d4c-dfd6-461e-af62-21a0ec2f3e65"
  })
  polygonUuid: string;

  @ApiProperty({
    description: "List of validation criteria results for this polygon",
    type: ValidationCriteriaDto,
    isArray: true
  })
  criteriaList: ValidationCriteriaDto[];
}

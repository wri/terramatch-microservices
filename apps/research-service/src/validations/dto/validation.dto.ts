import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { IsArray, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { ValidationCriteriaDto } from "./validation-response.dto";

@JsonApiDto({ type: "validations" })
export class ValidationDto {
  @ApiProperty({
    description: "The UUID of the polygon that was validated",
    example: "d6502d4c-dfd6-461e-af62-21a0ec2f3e65",
    type: String
  })
  @IsString()
  polygonId: string;

  @ApiProperty({
    description: "List of validation criteria results for this polygon",
    type: [ValidationCriteriaDto],
    isArray: true
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValidationCriteriaDto)
  criteriaList: ValidationCriteriaDto[];
}

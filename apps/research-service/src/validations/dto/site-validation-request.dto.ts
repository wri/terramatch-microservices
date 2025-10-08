import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsIn, IsOptional } from "class-validator";
import { VALIDATION_TYPES, ValidationType } from "@terramatch-microservices/database/constants";

export class SiteValidationRequestDto {
  @ApiProperty({
    enum: VALIDATION_TYPES,
    name: "validationTypes[]",
    isArray: true,
    required: false,
    description:
      "Array of validation types to run on all polygons in the site. If not provided, all validation types will be run."
  })
  @IsOptional()
  @IsArray()
  @IsIn(VALIDATION_TYPES, { each: true })
  validationTypes?: ValidationType[];
}

import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsIn, IsOptional } from "class-validator";
import { VALIDATION_TYPES, ValidationType } from "@terramatch-microservices/database/constants";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

export class SiteValidationRequestAttributes {
  @ApiProperty({
    enum: VALIDATION_TYPES,
    isArray: true,
    required: false,
    description:
      "Array of validation types to run on all polygons in the site. If not provided or empty, all validation types will be run."
  })
  @IsOptional()
  @IsArray()
  @IsIn(VALIDATION_TYPES, { each: true })
  validationTypes?: ValidationType[];
}

export class SiteValidationRequestBody extends JsonApiBodyDto(
  class SiteValidationRequestData extends CreateDataDto("validations", SiteValidationRequestAttributes) {}
) {}

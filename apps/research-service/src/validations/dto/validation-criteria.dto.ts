import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import {
  VALIDATION_CRITERIA_IDS,
  CriteriaId,
  ValidationType,
  VALIDATION_TYPES
} from "@terramatch-microservices/database/constants";

@JsonApiDto({ type: "validationCriterias" })
export class ValidationCriteriaDto {
  @ApiProperty({
    description: "The validation criteria ID",
    enum: VALIDATION_CRITERIA_IDS
  })
  criteriaId: CriteriaId;

  @ApiProperty({
    description: "The validation type name (e.g., 'SELF_INTERSECTION', 'POLYGON_SIZE')",
    enum: VALIDATION_TYPES
  })
  validationType: ValidationType;

  @ApiProperty({
    description: "Whether the polygon passed this validation"
  })
  valid: boolean;

  @ApiProperty({
    description: "When this validation was last run (null for non-persistent validations)",
    type: Date,
    nullable: true
  })
  createdAt: Date | null;

  @ApiProperty({
    description: "Additional information about the validation result",
    required: false
  })
  extraInfo?: object | null;
}

@JsonApiDto({ type: "validationResponses" })
export class ValidationResponseDto {
  @ApiProperty({
    description: "Array of validation results for each polygon",
    isArray: true
  })
  results: ValidationCriteriaDto[];
}

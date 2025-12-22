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
    enum: VALIDATION_CRITERIA_IDS,
    example: VALIDATION_CRITERIA_IDS.DUPLICATE_GEOMETRY
  })
  criteriaId: CriteriaId;

  @ApiProperty({
    description: "The validation type name (e.g., 'SELF_INTERSECTION', 'POLYGON_SIZE', 'DUPLICATE_GEOMETRY')",
    enum: VALIDATION_TYPES,
    example: "DUPLICATE_GEOMETRY"
  })
  validationType: ValidationType;

  @ApiProperty({
    description: "Whether the polygon passed this validation",
    example: false
  })
  valid: boolean;

  @ApiProperty({
    description: "When this validation was last run (null for non-persistent validations)",
    type: Date,
    nullable: true,
    example: "2025-11-28T20:41:50.060Z"
  })
  createdAt: Date | null;

  @ApiProperty({
    description: "Additional information about the validation result",
    required: false,
    example: {
      polygonUuid: "54aa2c7a-e139-4017-b86b-d904f4a3ed5c",
      message: "This geometry already exists in the project",
      sitePolygonUuid: "fd6cd4e8-0c56-45dc-8991-1cebfd3871ca",
      sitePolygonName: "AREA_NAME"
    }
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

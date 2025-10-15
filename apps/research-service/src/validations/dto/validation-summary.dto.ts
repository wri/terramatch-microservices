import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ValidationType } from "@terramatch-microservices/database/constants";

export class ValidationTypeSummary {
  @ApiProperty({
    description: "Number of polygons that passed this validation"
  })
  valid: number;

  @ApiProperty({
    description: "Number of polygons that failed this validation"
  })
  invalid: number;
}

@JsonApiDto({ type: "validationSummaries" })
export class ValidationSummaryDto {
  @ApiProperty({
    description: "The UUID of the site that was validated",
    example: "7631be34-bbe0-4e1e-b4fe-592677dc4b50"
  })
  siteUuid: string;

  @ApiProperty({
    description: "Total number of polygons in the site"
  })
  totalPolygons: number;

  @ApiProperty({
    description: "Number of polygons that were validated"
  })
  validatedPolygons: number;

  @ApiProperty({
    description: "Summary of validation results by validation type",
    type: "object",
    additionalProperties: {
      type: "object",
      properties: {
        valid: { type: "number" },
        invalid: { type: "number" }
      }
    }
  })
  validationSummary: Record<ValidationType, ValidationTypeSummary>;

  @ApiProperty({
    description: "When the validation was completed"
  })
  completedAt: Date;
}

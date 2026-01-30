import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";

@JsonApiDto({ type: "validationSummaries" })
export class ValidationSummaryDto {
  @ApiProperty({
    description: "The UUID of the site that was validated (null for project-level validation)",
    example: "7631be34-bbe0-4e1e-b4fe-592677dc4b50",
    nullable: true
  })
  siteUuid: string | null;

  @ApiProperty({
    description: "Total number of polygons in the site"
  })
  totalPolygons: number;

  @ApiProperty({
    description: "Number of polygons that were validated"
  })
  validatedPolygons: number;

  @ApiProperty({
    description: "When the validation was completed"
  })
  completedAt: Date;
}

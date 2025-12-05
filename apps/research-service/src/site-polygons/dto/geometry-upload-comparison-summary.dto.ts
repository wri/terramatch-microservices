import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

@JsonApiDto({ type: "geometryUploadComparisonSummaries" })
export class GeometryUploadComparisonSummaryDto {
  constructor(data?: Partial<GeometryUploadComparisonSummaryDto>) {
    if (data != null) {
      populateDto(this, data);
    }
  }

  @ApiProperty({
    description: "Array of UUIDs of existing SitePolygons found in the database",
    example: ["550e8400-e29b-41d4-a716-446655440000", "660e8400-e29b-41d4-a716-446655440001"]
  })
  existingUuids: string[];

  @ApiProperty({
    description: "Total number of features in the uploaded file",
    example: 800
  })
  totalFeatures: number;

  @ApiProperty({
    description: "Number of features that will create new versions (UUIDs found in database)",
    example: 150
  })
  featuresForVersioning: number;

  @ApiProperty({
    description: "Number of features that will create new polygons (UUIDs not found or missing UUIDs)",
    example: 650
  })
  featuresForCreation: number;
}

import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

@JsonApiDto({ type: "geometryUploadComparisons" })
export class GeometryUploadComparisonDto {
  constructor(data?: Partial<GeometryUploadComparisonDto>) {
    if (data != null) {
      populateDto(this, data);
    }
  }

  @ApiProperty({
    description:
      "UUID of an existing SitePolygon found in the database. " +
      "If an uploaded feature has this UUID in properties.uuid, it will create a new version instead of a new polygon.",
    example: "550e8400-e29b-41d4-a716-446655440000"
  })
  uuid: string;
}

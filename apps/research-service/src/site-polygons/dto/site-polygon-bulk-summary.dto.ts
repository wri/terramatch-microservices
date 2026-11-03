import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";

@JsonApiDto({ type: "sitePolygonBulkSummaries" })
export class SitePolygonBulkSummaryDto {
  @ApiProperty({ description: "Number of site polygons the bulk action processed" })
  processedPolygons: number;
}

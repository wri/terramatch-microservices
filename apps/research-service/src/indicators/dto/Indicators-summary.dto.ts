import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";

@JsonApiDto({ type: "indicatorsSummary" })
export class IndicatorsSummaryDto {
  @ApiProperty({
    description: "The UUID of the site that was validated",
    example: "7631be34-bbe0-4e1e-b4fe-592677dc4b50"
  })
  polygonUuids: string[];

  @ApiProperty({
    description: "Total number of polygons"
  })
  totalPolygons: number;
}

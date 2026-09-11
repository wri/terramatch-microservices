import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { POLYGON_STATUSES, PolygonStatus } from "@terramatch-microservices/database/constants";

export class SitePolygonMapEntryDto {
  @ApiProperty({ description: "UUID of the site polygon version." })
  uuid: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "UUID of the associated polygon geometry. Used to match features in GeoServer tiles."
  })
  polygonUuid: string | null;

  @ApiProperty({
    enum: POLYGON_STATUSES,
    nullable: true,
    type: String,
    description: "Approval status of the polygon, used for map styling and status counts."
  })
  status: PolygonStatus | null;
}

@JsonApiDto({ type: "sitePolygonMapIndexes" })
export class SitePolygonMapIndexDto {
  constructor(polygons: SitePolygonMapEntryDto[]) {
    this.polygons = polygons;
    this.total = polygons.length;
  }

  @ApiProperty({
    type: () => SitePolygonMapEntryDto,
    isArray: true,
    description: "Every polygon matching the requested scope and filters."
  })
  polygons: SitePolygonMapEntryDto[];

  @ApiProperty({ description: "Number of polygons in the polygons array." })
  total: number;
}

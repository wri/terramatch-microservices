import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { SitePolygon } from "@terramatch-microservices/database/entities";

@JsonApiDto({ type: "dashboardSitepolygons" })
export class DashboardSitePolygonsLightDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  uuid: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ nullable: true, type: Number })
  lat: number | null;

  @ApiProperty({ nullable: true, type: Number })
  long: number | null;

  @ApiProperty({ nullable: true, type: String })
  name: string | null;

  constructor(sitePolygon: SitePolygon) {
    this.id = sitePolygon.id;
    this.uuid = sitePolygon.uuid;
    this.status = sitePolygon.status ?? "";
    this.lat = sitePolygon.lat;
    this.long = sitePolygon.long;
    this.name = sitePolygon.polyName;
  }
}

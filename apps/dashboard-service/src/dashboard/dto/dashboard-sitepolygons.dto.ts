import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

@JsonApiDto({ type: "dashboardSitepolygons" })
export class DashboardSitePolygonsLightDto {
  constructor(sitePolygon: SitePolygon) {
    populateDto<DashboardSitePolygonsLightDto, SitePolygon>(this, sitePolygon, {
      name: sitePolygon.polyName
    });
  }
  @ApiProperty()
  id: number;

  @ApiProperty({
    description: "UUID of the associated polygon geometry",
    nullable: true,
    type: String
  })
  polygonUuid: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ nullable: true, type: Number })
  lat: number | null;

  @ApiProperty({ nullable: true, type: Number })
  long: number | null;

  @ApiProperty({ nullable: true, type: String })
  name: string | null;
}

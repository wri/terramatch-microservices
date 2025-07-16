import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import { POLYGON_STATUSES, PolygonStatus } from "@terramatch-microservices/database/constants";
import { PLANTING_STATUSES, PlantingStatus } from "@terramatch-microservices/database/constants/planting-status";

@JsonApiDto({ type: "dashboardSitePolygons" })
export class DashboardSitePolygonDto {
  constructor(data: DashboardSitePolygonDto) {
    populateDto<DashboardSitePolygonDto>(this, data);
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ nullable: true, type: String })
  polyName: string | null;

  @ApiProperty({ enum: POLYGON_STATUSES })
  status: PolygonStatus;

  @ApiProperty({ nullable: true, type: String })
  siteUuid: string | null;

  @ApiProperty({ nullable: true, type: String })
  siteName: string | null;

  @ApiProperty({ nullable: true, type: String })
  projectUuid: string | null;

  @ApiProperty({ nullable: true, type: String })
  projectName: string | null;

  @ApiProperty({ nullable: true, type: Date })
  plantStart: Date | null;

  @ApiProperty({ nullable: true, type: Number })
  calcArea: number | null;

  @ApiProperty({ nullable: true, type: Number })
  lat: number | null;

  @ApiProperty({ nullable: true, type: Number })
  long: number | null;

  @ApiProperty({ nullable: true, type: String })
  practice: string | null;

  @ApiProperty({ nullable: true, type: String })
  targetSys: string | null;

  @ApiProperty({ nullable: true, type: String })
  distr: string | null;

  @ApiProperty({ nullable: true, type: Number })
  numTrees: number | null;

  @ApiProperty({ nullable: true, type: String })
  versionName: string | null;

  @ApiProperty({
    nullable: true,
    description: "Planting status for this site polygon",
    enum: PLANTING_STATUSES
  })
  plantingStatus: PlantingStatus | null;
}

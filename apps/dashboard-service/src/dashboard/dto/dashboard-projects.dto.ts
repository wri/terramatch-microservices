import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

@JsonApiDto({ type: "dashboardProjects" })
export class DashboardProjectsLightDto {
  constructor(data: DashboardProjectsLightDto) {
    populateDto<DashboardProjectsLightDto>(this, data);
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ nullable: true, type: String })
  country: string | null;

  @ApiProperty({ nullable: true, type: String })
  frameworkKey: string | null;

  @ApiProperty({ nullable: true, type: String })
  name: string | null;

  @ApiProperty({ nullable: true, type: Number })
  treesPlantedCount: number | null;

  @ApiProperty()
  totalHectaresRestoredSum: number;

  @ApiProperty({ nullable: true, type: Number })
  lat: number | null;

  @ApiProperty({ nullable: true, type: Number })
  long: number | null;

  @ApiProperty({ nullable: true, type: String })
  organisationName: string | null;

  @ApiProperty({ nullable: true, type: String })
  organisationType: string | null;

  @ApiProperty({ nullable: true, type: Number })
  treesGrownGoal: number | null;

  @ApiProperty()
  totalSites: number;
}

@JsonApiDto({ type: "dashboardProjects" })
export class DashboardProjectsFullDto extends DashboardProjectsLightDto {
  constructor(data: DashboardProjectsFullDto) {
    super(data);
    populateDto<DashboardProjectsFullDto>(this, data);
  }
  // TODO add fields for project view
}

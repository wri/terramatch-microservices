import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { DashboardEntityDto } from "./dashboard-entity.dto";

@JsonApiDto({ type: "dashboardProjects" })
export class DashboardProjectsLightDto extends DashboardEntityDto {
  constructor(data: DashboardProjectsLightDto) {
    super();
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

  @ApiProperty({ description: "Whether this is a light version of the project data" })
  is_light: boolean;
  @ApiProperty({ nullable: true, type: Number })
  totalJobsCreated: number | null;
}

@JsonApiDto({ type: "dashboardProjects" })
export class DashboardProjectsFullDto extends DashboardProjectsLightDto {
  constructor(data: DashboardProjectsFullDto) {
    super(data);
    populateDto<DashboardProjectsFullDto>(this, data);
  }

  @ApiProperty({ nullable: true, type: String, isArray: true })
  cohort: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  objectives: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  landTenureProjectArea: string[] | null;
}

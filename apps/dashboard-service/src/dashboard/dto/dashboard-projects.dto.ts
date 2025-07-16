import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { DashboardEntityDto } from "./dashboard-entity.dto";
import { Project } from "@terramatch-microservices/database/entities";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";

@JsonApiDto({ type: "dashboardProjects" })
export class DashboardProjectsLightDto extends DashboardEntityDto {
  constructor(project?: Project, props?: HybridSupportProps<DashboardProjectsLightDto, Project>) {
    super();
    if (project != null && props != null) {
      populateDto<DashboardProjectsLightDto, Project>(this, project, { lightResource: true, ...props });
    }
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

  @ApiProperty({ nullable: true, type: Number })
  totalJobsCreated: number | null;
}

export class DashboardProjectsFullDto extends DashboardProjectsLightDto {
  constructor(project: Project, props: HybridSupportProps<DashboardProjectsFullDto, Project>) {
    super();
    populateDto<DashboardProjectsFullDto, Project>(this, project, { lightResource: false, ...props });
  }

  @ApiProperty({ nullable: true, type: String, isArray: true })
  cohort: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  objectives: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  landTenureProjectArea: string[] | null;
}

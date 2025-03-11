import { ProjectReport } from "@terramatch-microservices/database/entities";
import { EntityDto, AdditionalProps } from "./entity.dto";
import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { JsonApiDto } from "@terramatch-microservices/common/decorators/json-api-dto.decorator";
import { ApiProperty } from "@nestjs/swagger";

@JsonApiDto({ type: "project-reports" })
export class ProjectReportLightDto extends EntityDto {
  constructor(projectReport?: ProjectReport) {
    super();
    if (projectReport != null) {
      this.populate(ProjectReportLightDto, {
        ...pickApiProperties(projectReport, ProjectReportLightDto),
        lightResource: true,
        // these two are untyped and marked optional in the base model.
        createdAt: projectReport.createdAt as Date,
        updatedAt: projectReport.createdAt as Date
      });
    }
  }

  @ApiProperty()
  frameworkKey: string | null;

  @ApiProperty()
  frameworkUuid: string | null;

  @ApiProperty({
    nullable: true,
    description: "The associated organisation name"
  })
  organisationName: string | null;

  @ApiProperty({ nullable: true })
  projectName: string | null;

  @ApiProperty({ nullable: true })
  projectUuid: string | null;

  @ApiProperty()
  status: string;

  @ApiProperty({ nullable: true })
  submittedAt: Date | null;

  @ApiProperty({ nullable: true })
  taskId: number | null;

  @ApiProperty({ nullable: true })
  title: string | null;

  @ApiProperty()
  updateRequestStatus: string;

  @ApiProperty()
  dueAt: Date | null;

  @ApiProperty()
  workdaysPaid: number | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// export type AdditionalProjectReportLightProps = Pick<ProjectReportLightDto, "treesPlantedCount">;
export type AdditionalProjectReportFullProps =
  /*AdditionalProjectReportLightProps &*/
  AdditionalProps<ProjectReportFullDto, ProjectReportLightDto & Omit<ProjectReport, "project">>;

export class ProjectReportFullDto extends ProjectReportLightDto {
  constructor(projectReport: ProjectReport, props: AdditionalProjectReportFullProps) {
    super();
    this.populate(ProjectReportFullDto, {
      ...pickApiProperties(projectReport, ProjectReportFullDto),
      lightResource: false,
      // these two are untyped and marked optional in the base model.
      createdAt: projectReport.createdAt as Date,
      updatedAt: projectReport.createdAt as Date,
      ...props
    });
  }
}

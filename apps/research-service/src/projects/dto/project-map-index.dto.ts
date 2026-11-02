import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import {
  FRAMEWORK_KEYS,
  FrameworkKey,
  PROJECT_QA_STATUS_VALUES,
  ProjectQaStatus
} from "@terramatch-microservices/database/constants";

export class ProjectMapEntryDto {
  @ApiProperty({ description: "UUID of the project." })
  uuid: string;

  @ApiProperty({ nullable: true, type: String, description: "Project name." })
  name: string | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      "Latitude of the project centroid (average of its polygon centroids). Null when the project has no polygons."
  })
  lat: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      "Longitude of the project centroid (average of its polygon centroids). Null when the project has no polygons."
  })
  long: number | null;

  @ApiProperty({ nullable: true, type: String, enum: FRAMEWORK_KEYS, description: "Framework key of the project." })
  frameworkKey: FrameworkKey | null;

  @ApiProperty({ nullable: true, type: String, isArray: true, description: "Project country codes (GADM level 0)." })
  level0Project: string[] | null;

  @ApiProperty({ nullable: true, type: String, description: "Cohort of the project." })
  cohort: string | null;

  @ApiProperty({ description: "Number of active polygons across the project's sites." })
  polygonCount: number;

  @ApiProperty({ description: "Sum of numTrees across the project's active polygons." })
  sumNumTrees: number;

  @ApiProperty({ description: "Sum of calcArea (ha) across the project's active polygons." })
  sumCalcArea: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: "Reporting cycle (1-5) of the most recently updated QA status. Null when there is no QA status."
  })
  latestQaCycle: number | null;

  @ApiProperty({
    nullable: true,
    type: String,
    enum: PROJECT_QA_STATUS_VALUES,
    description: "QA status of the most recently updated reporting cycle. Null when there is none, or it was cleared."
  })
  latestQaStatus: ProjectQaStatus | null;
}

@JsonApiDto({ type: "projectMapIndexes" })
export class ProjectMapIndexDto {
  constructor(projects: ProjectMapEntryDto[]) {
    this.projects = projects;
    this.total = projects.length;
  }

  @ApiProperty({
    type: () => ProjectMapEntryDto,
    isArray: true,
    description: "Every project that matches the requested filters, including projects without a centroid."
  })
  projects: ProjectMapEntryDto[];

  @ApiProperty({ description: "Number of projects in the projects array." })
  total: number;
}

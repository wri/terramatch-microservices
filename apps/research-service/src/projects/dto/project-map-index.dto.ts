import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { FRAMEWORK_KEYS, FrameworkKey } from "@terramatch-microservices/database/constants";

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

  @ApiProperty({ nullable: true, type: String, description: "Country code of the project." })
  country: string | null;

  @ApiProperty({ nullable: true, type: String, description: "Cohort of the project." })
  cohort: string | null;

  @ApiProperty({ description: "Number of active polygons across the project's sites." })
  polygonCount: number;
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

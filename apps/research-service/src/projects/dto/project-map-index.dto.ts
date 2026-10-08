import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";

export class ProjectMapEntryDto {
  @ApiProperty({ description: "UUID of the project." })
  uuid: string;

  @ApiProperty({ nullable: true, type: String, description: "Project name." })
  name: string | null;

  @ApiProperty({ description: "Latitude of the project centroid (average of its polygon centroids)." })
  lat: number;

  @ApiProperty({ description: "Longitude of the project centroid (average of its polygon centroids)." })
  long: number;
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
    description: "Every project with a centroid that matches the requested filters."
  })
  projects: ProjectMapEntryDto[];

  @ApiProperty({ description: "Number of projects in the projects array." })
  total: number;
}

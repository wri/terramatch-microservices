import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { FRAMEWORK_KEYS, FrameworkKey } from "@terramatch-microservices/database/constants";

export class ProjectFilterOrganisationOptionDto {
  @ApiProperty({ description: "UUID of the organisation." })
  uuid: string;

  @ApiProperty({ nullable: true, type: String, description: "Name of the organisation." })
  name: string | null;

  @ApiProperty({ description: "Number of matching accessible projects owned by the organisation." })
  count: number;
}

export class ProjectFilterFrameworkOptionDto {
  @ApiProperty({ enum: FRAMEWORK_KEYS, description: "Framework key." })
  value: FrameworkKey;

  @ApiProperty({ description: "Number of matching accessible projects in the framework." })
  count: number;
}

export class ProjectFilterCountryOptionDto {
  @ApiProperty({ description: "Country code (GADM level 0) of the project." })
  value: string;

  @ApiProperty({ description: "Number of matching accessible projects in the country." })
  count: number;
}

export class ProjectFilterProjectOptionDto {
  @ApiProperty({ description: "UUID of the project." })
  uuid: string;

  @ApiProperty({ nullable: true, type: String, description: "Project name." })
  name: string | null;
}

@JsonApiDto({ type: "projectFilterOptions" })
export class ProjectFilterOptionsDto {
  constructor(options: {
    organisations: ProjectFilterOrganisationOptionDto[];
    frameworkKeys: ProjectFilterFrameworkOptionDto[];
    countries: ProjectFilterCountryOptionDto[];
    projects: ProjectFilterProjectOptionDto[];
  }) {
    this.organisations = options.organisations;
    this.frameworkKeys = options.frameworkKeys;
    this.countries = options.countries;
    this.projects = options.projects;
  }

  @ApiProperty({
    type: () => ProjectFilterOrganisationOptionDto,
    isArray: true,
    description: "Organisations that own at least one accessible project matching the other selected filters."
  })
  organisations: ProjectFilterOrganisationOptionDto[];

  @ApiProperty({
    type: () => ProjectFilterFrameworkOptionDto,
    isArray: true,
    description: "Frameworks of accessible projects matching the other selected filters."
  })
  frameworkKeys: ProjectFilterFrameworkOptionDto[];

  @ApiProperty({
    type: () => ProjectFilterCountryOptionDto,
    isArray: true,
    description: "Countries of accessible projects matching the other selected filters."
  })
  countries: ProjectFilterCountryOptionDto[];

  @ApiProperty({
    type: () => ProjectFilterProjectOptionDto,
    isArray: true,
    description: "Accessible projects matching the other selected filters and the project search."
  })
  projects: ProjectFilterProjectOptionDto[];
}

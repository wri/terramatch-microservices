import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString, ValidateNested } from "class-validator";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { NumberPage } from "@terramatch-microservices/common/dto/page.dto";

export class NurseriesMetaQueryDto extends IntersectionType(NumberPage) {
  @ApiProperty({ required: false, description: "Matches nursery, project or organisation names" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, description: "Only the project with this uuid" })
  @IsOptional()
  @IsString()
  projectUuid?: string;

  @ApiProperty({ required: false, isArray: true, type: String })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  status?: string[];

  @ApiProperty({ required: false, isArray: true, type: String })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  updateRequestStatus?: string[];

  @ValidateNested()
  @IsOptional()
  page?: NumberPage;
}

/**
 * Per-project summary used to build the nurseries index: the projects with at least one nursery
 * matching the filters, with counts and seedlings grown for the section header.
 */
@JsonApiDto({ type: "projectNurseriesMetas" })
export class ProjectNurseriesMetaDto {
  constructor(data: ProjectNurseriesMetaDto) {
    populateDto<ProjectNurseriesMetaDto>(this, data);
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ nullable: true, type: String })
  name: string | null;

  @ApiProperty({ nullable: true, type: String })
  organisationName: string | null;

  @ApiProperty({ nullable: true, type: String })
  frameworkKey: string | null;

  @ApiProperty({ description: "Number of nurseries in the project, ignoring the filters" })
  nurseriesTotal: number;

  @ApiProperty({ description: "Number of nurseries in the project that match the filters" })
  nurseriesMatching: number;

  @ApiProperty({ description: "Seedlings grown across all nurseries in the project" })
  seedlingsGrownTotal: number;

  @ApiProperty({ description: "Seedlings grown across the nurseries that match the filters" })
  seedlingsGrownMatching: number;
}

export class SitesMetaQueryDto extends IntersectionType(NumberPage) {
  @ApiProperty({ required: false, description: "Matches site or project names" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, description: "Only the project with this uuid" })
  @IsOptional()
  @IsString()
  projectUuid?: string;

  @ApiProperty({ required: false, isArray: true, type: String })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  status?: string[];

  @ApiProperty({ required: false, isArray: true, type: String })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  updateRequestStatus?: string[];

  @ValidateNested()
  @IsOptional()
  page?: NumberPage;
}

/**
 * Per-project summary used to build the sites index: the projects with at least one site matching the
 * filters, with site counts and the trees planted / hectares restored totals for the section header.
 */
@JsonApiDto({ type: "projectSitesMetas" })
export class ProjectSitesMetaDto {
  constructor(data: ProjectSitesMetaDto) {
    populateDto<ProjectSitesMetaDto>(this, data);
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ nullable: true, type: String })
  name: string | null;

  @ApiProperty({ nullable: true, type: String })
  organisationName: string | null;

  @ApiProperty({ nullable: true, type: String })
  frameworkKey: string | null;

  @ApiProperty({ description: "Number of sites in the project, ignoring the filters" })
  sitesTotal: number;

  @ApiProperty({ description: "Number of sites in the project that match the filters" })
  sitesMatching: number;

  @ApiProperty({ description: "Trees planted across all sites in the project" })
  treesPlantedTotal: number;

  @ApiProperty({ description: "Trees planted across the sites that match the filters" })
  treesPlantedMatching: number;

  @ApiProperty({ description: "Hectares restored across all sites in the project" })
  hectaresRestoredTotal: number;

  @ApiProperty({ description: "Hectares restored across the sites that match the filters" })
  hectaresRestoredMatching: number;

  @ApiProperty({ description: "Workdays across the approved sites that match the filters" })
  workdaysMatching: number;
}

import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from "class-validator";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { NumberPage } from "@terramatch-microservices/common/dto/page.dto";
import { PLANTING_STATUSES, PlantingStatus } from "@terramatch-microservices/database/constants/planting-status";
import { ENTITY_STATUSES, EntityStatus } from "@terramatch-microservices/database/constants/status";

/** Filter value for the projects with no planting status on an approved report. */
export const PLANTING_STATUS_NOT_AVAILABLE = "not-available";
const PLANTING_STATUS_FILTERS = [...PLANTING_STATUSES, PLANTING_STATUS_NOT_AVAILABLE] as const;
export type PlantingStatusFilter = (typeof PLANTING_STATUS_FILTERS)[number];

export class ProjectsMetaQueryDto extends IntersectionType(NumberPage) {
  @ApiProperty({ required: false, description: "Matches project names" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, isArray: true, enum: ENTITY_STATUSES })
  @IsOptional()
  @IsArray()
  @IsIn(ENTITY_STATUSES, { each: true })
  status?: EntityStatus[];

  @ApiProperty({
    required: false,
    isArray: true,
    enum: PLANTING_STATUS_FILTERS,
    description: "Matches the planting status on the latest approved project report"
  })
  @IsOptional()
  @IsArray()
  @IsIn(PLANTING_STATUS_FILTERS, { each: true })
  plantingStatus?: PlantingStatusFilter[];

  @ApiProperty({ required: false, isArray: true, type: String })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  frameworkKey?: string[];

  @ApiProperty({ required: false, isArray: true, type: String, description: "Matches level 0 country codes" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  country?: string[];

  @ValidateNested()
  @IsOptional()
  page?: NumberPage;
}

/** Per-project summary used to build the project cards on the My Projects index. */
@JsonApiDto({ type: "projectMetas" })
export class ProjectMetaDto {
  constructor(data: ProjectMetaDto) {
    populateDto<ProjectMetaDto>(this, data);
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ nullable: true, type: String })
  name: string | null;

  @ApiProperty({ nullable: true, type: String })
  organisationName: string | null;

  @ApiProperty({ nullable: true, type: String })
  frameworkKey: string | null;

  @ApiProperty({ enum: ENTITY_STATUSES })
  status: EntityStatus;

  @ApiProperty({
    nullable: true,
    enum: PLANTING_STATUSES,
    description: "The planting status on the latest approved project report that has one"
  })
  plantingStatus: PlantingStatus | null;

  @ApiProperty({ nullable: true, type: String, isArray: true, description: "Level 0 country codes" })
  level0Project: string[] | null;

  @ApiProperty({ description: "Number of approved sites" })
  totalSites: number;

  @ApiProperty({ description: "Number of approved nurseries" })
  totalNurseries: number;

  @ApiProperty({ description: "Number of project reports in any status" })
  totalProjectReports: number;

  @ApiProperty({ description: "Trees planted on the approved reports of the approved sites" })
  treesPlantedCount: number;

  @ApiProperty({ description: "Seeds planted on the approved reports of the approved sites" })
  seedsPlantedCount: number;

  @ApiProperty({ description: "Trees regenerating on the approved reports of the approved sites" })
  regeneratedTreesCount: number;

  @ApiProperty()
  treesGrownGoal: number;

  @ApiProperty({ description: "Hectares within the approved polygons of the approved sites" })
  totalHectaresRestoredSum: number;

  @ApiProperty()
  totalHectaresRestoredGoal: number;

  @ApiProperty({ description: "Workdays on the approved project and site reports" })
  combinedWorkdayCount: number;

  @ApiProperty({ description: "Jobs on the approved project reports" })
  totalJobsCreated: number;

  @ApiProperty({ nullable: true, type: Number })
  jobsCreatedGoal: number | null;
}

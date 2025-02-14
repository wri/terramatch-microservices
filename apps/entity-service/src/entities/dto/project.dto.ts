import { JsonApiAttributes, pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import {
  ENTITY_STATUSES,
  EntityStatus,
  UPDATE_REQUEST_STATUSES,
  UpdateRequestStatus
} from "@terramatch-microservices/database/constants/status";
import { ApiProperty } from "@nestjs/swagger";
import { Project } from "@terramatch-microservices/database/entities";

class ProjectDtoBase<T> extends JsonApiAttributes<Omit<T, "lightResource">> {
  @ApiProperty()
  uuid: string;

  @ApiProperty({ nullable: true, description: "Framework key for this project" })
  frameworkKey: string | null;

  @ApiProperty({
    nullable: true,
    description: "Framework UUID. Will be removed after the FE is refactored to not use these IDs",
    deprecated: true
  })
  frameworkUuid: string | null;

  @ApiProperty({
    nullable: true,
    description: "The associated organisation name"
  })
  organisationName: string | null;

  @ApiProperty({
    nullable: true,
    description: "Entity status for this project",
    enum: ENTITY_STATUSES
  })
  status: EntityStatus | null;

  @ApiProperty({
    nullable: true,
    description: "Update request status for this project",
    enum: UPDATE_REQUEST_STATUSES
  })
  updateRequestStatus: UpdateRequestStatus | null;

  @ApiProperty({ nullable: true })
  name: string | null;

  @ApiProperty({ nullable: true })
  plantingStartDate: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

@JsonApiDto({ type: "projects" })
export class ProjectLightDto extends ProjectDtoBase<ProjectLightDto> {
  constructor(project: Project) {
    super({
      ...pickApiProperties(project as Omit<Project, "lightResource">, ProjectLightDto),
      // these two are untyped and marked optional in the base model.
      createdAt: project.createdAt as Date,
      updatedAt: project.updatedAt as Date
    });
  }

  @ApiProperty({
    type: Boolean,
    example: true,
    description: "Indicates that this resource does not have the full resource definition."
  })
  lightResource = true;
}

export type AdditionalProjectFullProps = {
  totalHectaresRestoredSum: number;
  treesPlantedCount: number;
  seedsPlantedCount: number;
  regeneratedTreesCount: number;
  workdayCount: number;
  selfReportedWorkdayCount: number;
  combinedWorkdayCount: number;
  totalJobsCreated: number;
  totalSites: number;
  totalNurseries: number;
  totalProjectReports: number;
  totalOverdueReports: number;
  treesRestoredPpc: number;
  assistedNaturalRegenerationList: ANRDto[];
};

export class ANRDto {
  @ApiProperty({ description: "Site name" })
  name: string;

  @ApiProperty()
  treeCount: number;
}

@JsonApiDto({ type: "projects" })
export class ProjectFullDto extends ProjectDtoBase<ProjectFullDto> {
  constructor(project: Project, props: AdditionalProjectFullProps) {
    super({
      ...pickApiProperties(
        project as Omit<Project, "lightResource" | keyof AdditionalProjectFullProps>,
        ProjectFullDto
      ),
      // these two are untyped and marked optional in the base model.
      createdAt: project.createdAt as Date,
      updatedAt: project.updatedAt as Date,
      ...props
    });
  }

  @ApiProperty({
    type: Boolean,
    example: false,
    description: "Indicates that this resource has the full resource definition."
  })
  lightResource = false;

  @ApiProperty({
    description: "True for projects that are test data and do not represent actual planting on the ground."
  })
  isTest: boolean;

  @ApiProperty({ nullable: true })
  feedback: string | null;

  @ApiProperty({ nullable: true })
  feedbackFields: string[] | null;

  @ApiProperty({ nullable: true })
  continent: string | null;

  @ApiProperty({ nullable: true })
  country: string | null;

  @ApiProperty({ nullable: true })
  states: string[] | null;

  @ApiProperty({ nullable: true })
  projectCountyDistrict: string | null;

  @ApiProperty({ nullable: true })
  plantingEndDate: Date | null;

  @ApiProperty({ nullable: true })
  budget: number | null;

  @ApiProperty({ nullable: true })
  history: string | null;

  @ApiProperty({ nullable: true })
  objectives: string | null;

  @ApiProperty({ nullable: true })
  environmentalGoals: string | null;

  @ApiProperty({ nullable: true })
  socioeconomicGoals: string | null;

  @ApiProperty({ nullable: true })
  sdgsImpacted: string | null;

  @ApiProperty({ nullable: true })
  totalHectaresRestoredGoal: number | null;

  @ApiProperty()
  totalHectaresRestoredSum: number;

  @ApiProperty({ nullable: true })
  treesGrownGoal: number | null;

  @ApiProperty({ nullable: true })
  survivalRate: number | null;

  @ApiProperty({ nullable: true })
  landUseTypes: string[] | null;

  @ApiProperty({ nullable: true })
  restorationStrategy: string[] | null;

  @ApiProperty()
  treesPlantedCount: number;

  @ApiProperty()
  seedsPlantedCount: number;

  @ApiProperty()
  regeneratedTreesCount: number;

  @ApiProperty()
  workdayCount: number;

  @ApiProperty()
  selfReportedWorkdayCount: number;

  @ApiProperty()
  combinedWorkdayCount: number;

  @ApiProperty()
  totalJobsCreated: number;

  @ApiProperty()
  totalSites: number;

  @ApiProperty()
  totalNurseries: number;

  @ApiProperty()
  totalProjectReports: number;

  @ApiProperty()
  totalOverdueReports: number;

  @ApiProperty({ nullable: true })
  descriptionOfProjectTimeline: string | null;

  @ApiProperty({ nullable: true })
  sitingStrategyDescription: string | null;

  @ApiProperty({ nullable: true })
  sitingStrategy: string | null;

  @ApiProperty({ nullable: true })
  landholderCommEngage: string | null;

  @ApiProperty({ nullable: true })
  projPartnerInfo: string | null;

  @ApiProperty({ nullable: true })
  seedlingsSource: string | null;

  @ApiProperty({ nullable: true })
  landTenureProjectArea: string[] | null;

  @ApiProperty({ nullable: true })
  projImpactBiodiv: string | null;

  @ApiProperty({ nullable: true })
  projImpactFoodsec: string | null;

  @ApiProperty({ nullable: true })
  proposedGovPartners: string | null;

  @ApiProperty()
  treesRestoredPpc: number;

  @ApiProperty({ nullable: true })
  detailedInterventionTypes: string[] | null;

  @ApiProperty({
    type: () => ANRDto,
    isArray: true,
    description: "The list of tree counts regenerating naturally by site name"
  })
  assistedNaturalRegenerationList: ANRDto[];

  @ApiProperty({ nullable: true })
  goalTreesRestoredAnr: number | null;
}

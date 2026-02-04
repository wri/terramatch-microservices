import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import {
  ENTITY_STATUSES,
  EntityStatus,
  PLANTING_STATUSES,
  PlantingStatus,
  UPDATE_REQUEST_STATUSES,
  UpdateRequestStatus
} from "@terramatch-microservices/database/constants/status";
import { ApiProperty } from "@nestjs/swagger";
import { Project } from "@terramatch-microservices/database/entities";
import { EntityDto } from "./entity.dto";
import { MediaDto } from "@terramatch-microservices/common/dto/media.dto";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";

@JsonApiDto({ type: "projects" })
export class ProjectLightDto extends EntityDto {
  constructor(project?: Project, props?: HybridSupportProps<ProjectLightDto, Project>) {
    super();
    if (project != null && props != null) {
      populateDto<ProjectLightDto, Project>(this, project, { lightResource: true, ...props });
    }
  }

  @ApiProperty({ nullable: true, type: String, description: "Framework key for this project" })
  frameworkKey: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated organisation name"
  })
  organisationName: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated organisation uuid"
  })
  organisationUuid: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated organisation type"
  })
  organisationType: string | null;

  @ApiProperty({
    description: "Entity status for this project",
    enum: ENTITY_STATUSES
  })
  status: EntityStatus;

  @ApiProperty({
    nullable: true,
    description: "Planting status for this project",
    enum: PLANTING_STATUSES
  })
  plantingStatus: PlantingStatus | null;

  @ApiProperty({
    nullable: true,
    description: "Update request status for this project",
    enum: UPDATE_REQUEST_STATUSES
  })
  updateRequestStatus: UpdateRequestStatus | null;

  @ApiProperty({ nullable: true, type: String })
  name: string | null;

  @ApiProperty({ nullable: true, type: String })
  shortName: string | null;

  @ApiProperty({ nullable: true, type: Date })
  plantingStartDate: Date | null;

  @ApiProperty({ nullable: true, type: String })
  country: string | null;

  @ApiProperty({ nullable: true, type: Number, description: "Latitude coordinate" })
  lat: number | null;

  @ApiProperty({ nullable: true, type: Number, description: "Longitude coordinate" })
  long: number | null;

  @ApiProperty()
  totalHectaresRestoredSum: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ nullable: true, type: Number })
  treesPlantedCount: number | null;
}

export type ProjectMedia = Pick<ProjectFullDto, keyof typeof Project.MEDIA>;

export class ANRDto {
  @ApiProperty({ description: "Site name" })
  name: string;

  @ApiProperty()
  treeCount: number;
}

export class ProjectApplicationDto {
  @ApiProperty()
  uuid: string;

  @ApiProperty({ nullable: true, type: String })
  fundingProgrammeName: string | null;

  @ApiProperty({ nullable: true, type: String })
  projectPitchUuid: string | null;
}

export class ProjectFullDto extends ProjectLightDto {
  constructor(
    project: Project,
    props: HybridSupportProps<ProjectFullDto, Omit<Project, "application" | "feedback" | "feedbackFields">>
  ) {
    super();
    populateDto<ProjectFullDto, Project>(this, project, { lightResource: false, ...props });
  }

  @ApiProperty({
    description: "True for projects that are test data and do not represent actual planting on the ground."
  })
  isTest: boolean;

  @ApiProperty({ nullable: true, type: String })
  feedback: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  feedbackFields: string[] | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  cohort: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  continent: string | null;

  @ApiProperty({ nullable: true, type: String })
  country: string | null;

  @ApiProperty({ nullable: true, type: String, description: "The associated organisation type" })
  organisationType: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  states: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  projectCountyDistrict: string | null;

  @ApiProperty({ nullable: true, type: Date })
  plantingEndDate: Date | null;

  @ApiProperty({ nullable: true, type: String })
  description: string | null;

  @ApiProperty({ nullable: true, type: Number })
  budget: number | null;

  @ApiProperty({ nullable: true, type: String })
  history: string | null;

  @ApiProperty({ nullable: true, type: String })
  objectives: string | null;

  @ApiProperty({ nullable: true, type: String })
  environmentalGoals: string | null;

  @ApiProperty({ nullable: true, type: String })
  socioeconomicGoals: string | null;

  @ApiProperty({ nullable: true, type: String })
  sdgsImpacted: string | null;

  @ApiProperty({ nullable: true, type: Number })
  totalHectaresRestoredGoal: number | null;

  @ApiProperty({ nullable: true, type: Number })
  treesGrownGoal: number | null;

  @ApiProperty({ nullable: true, type: Number })
  survivalRate: number | null;

  @ApiProperty({ nullable: true, type: Number })
  lastReportedSurvivalRate: number | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  landUseTypes: string[] | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  restorationStrategy: string[] | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  incomeGeneratingActivities: string[] | null;

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

  @ApiProperty({ nullable: true, type: String })
  descriptionOfProjectTimeline: string | null;

  @ApiProperty({ nullable: true, type: String })
  sitingStrategyDescription: string | null;

  @ApiProperty({ nullable: true, type: String })
  sitingStrategy: string | null;

  @ApiProperty({ nullable: true, type: String })
  landholderCommEngage: string | null;

  @ApiProperty({ nullable: true, type: String })
  communityIncentives: string | null;

  @ApiProperty({ nullable: true, type: String })
  projPartnerInfo: string | null;

  @ApiProperty({ nullable: true, type: String })
  seedlingsSource: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  landTenureProjectArea: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  projImpactBiodiv: string | null;

  @ApiProperty({ nullable: true, type: String })
  projImpactFoodsec: string | null;

  @ApiProperty({ nullable: true, type: String })
  proposedGovPartners: string | null;

  @ApiProperty()
  treesRestoredPpc: number;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  detailedInterventionTypes: string[] | null;

  @ApiProperty({
    type: () => ANRDto,
    isArray: true,
    description: "The list of tree counts regenerating naturally by site name"
  })
  assistedNaturalRegenerationList: ANRDto[];

  @ApiProperty({ nullable: true, type: Number })
  goalTreesRestoredAnr: number | null;

  @ApiProperty({ nullable: true, type: Number })
  directSeedingSurvivalRate: number | null;

  @ApiProperty({ nullable: true, type: ProjectApplicationDto })
  application: ProjectApplicationDto | null;

  @ApiProperty({ type: () => MediaDto, isArray: true })
  media: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  socioeconomicBenefits: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  file: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  otherAdditionalDocuments: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  photos: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  documentFiles: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  programmeSubmission: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  proofOfLandTenureMou: MediaDto[];

  @ApiProperty({ nullable: true, type: MediaDto })
  detailedProjectBudget: MediaDto | null;
}

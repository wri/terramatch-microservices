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
import { AdditionalProps, EntityDto } from "./entity.dto";
import { MediaDto } from "./media.dto";

@JsonApiDto({ type: "projects" })
export class ProjectLightDto extends EntityDto {
  constructor(project?: Project, props?: AdditionalProjectLightProps) {
    super();
    if (project != null) {
      this.populate(ProjectLightDto, {
        ...pickApiProperties(project, ProjectLightDto),
        lightResource: true,
        // these two are untyped and marked optional in the base model.
        createdAt: project.createdAt as Date,
        updatedAt: project.updatedAt as Date,
        ...props
      });
    }
  }

  @ApiProperty({ nullable: true, description: "Framework key for this project" })
  frameworkKey: string | null;

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

  @ApiProperty({ nullable: true })
  country: string | null;

  @ApiProperty()
  totalHectaresRestoredSum: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export type AdditionalProjectLightProps = Pick<ProjectLightDto, "totalHectaresRestoredSum">;
export type AdditionalProjectFullProps = AdditionalProjectLightProps &
  AdditionalProps<ProjectFullDto, ProjectLightDto & Omit<Project, "application">>;
export type ProjectMedia = Pick<ProjectFullDto, keyof typeof Project.MEDIA>;

export class ANRDto {
  @ApiProperty({ description: "Site name" })
  name: string;

  @ApiProperty()
  treeCount: number;
}

export class ProjectApplicationDto extends JsonApiAttributes<ProjectApplicationDto> {
  @ApiProperty()
  uuid: string;

  @ApiProperty()
  fundingProgrammeName: string;

  @ApiProperty()
  projectPitchUuid: string;
}

export class ProjectFullDto extends ProjectLightDto {
  constructor(project: Project, props: AdditionalProjectFullProps) {
    super();
    this.populate(ProjectFullDto, {
      ...pickApiProperties(project, ProjectFullDto),
      lightResource: false,
      // these two are untyped and marked optional in the base model.
      createdAt: project.createdAt as Date,
      updatedAt: project.updatedAt as Date,
      ...props
    });
  }

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

  @ApiProperty({ nullable: true })
  directSeedingSurvivalRate: number | null;

  @ApiProperty({ nullable: true })
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

  @ApiProperty({ nullable: true })
  detailedProjectBudget: MediaDto | null;

  @ApiProperty({ type: () => MediaDto, isArray: true })
  proofOfLandTenureMou: MediaDto[];
}

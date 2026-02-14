import { ProjectReport } from "@terramatch-microservices/database/entities";
import { EntityDto } from "./entity.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { JsonApiDto } from "@terramatch-microservices/common/decorators/json-api-dto.decorator";
import { ApiProperty } from "@nestjs/swagger";
import { MediaDto } from "@terramatch-microservices/common/dto/media.dto";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";
import {
  REPORT_STATUSES,
  ReportStatus,
  UPDATE_REQUEST_STATUSES,
  UpdateRequestStatus
} from "@terramatch-microservices/database/constants/status";

@JsonApiDto({ type: "projectReports" })
export class ProjectReportLightDto extends EntityDto {
  constructor(projectReport?: ProjectReport) {
    super();
    if (projectReport != null) {
      populateDto<ProjectReportLightDto, ProjectReport>(this, projectReport, { lightResource: true });
    }
  }

  @ApiProperty({ nullable: true, type: String })
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

  @ApiProperty({ nullable: true, type: String })
  projectName: string | null;

  @ApiProperty({ nullable: true, type: String })
  projectUuid: string | null;

  @ApiProperty({
    description: "Report status for this project report",
    enum: REPORT_STATUSES
  })
  status: ReportStatus;

  @ApiProperty({ nullable: true, type: Number })
  completion: number | null;

  @ApiProperty({ nullable: true, type: Date })
  submittedAt: Date | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated task uuid"
  })
  taskUuid: string | null;

  @ApiProperty({ nullable: true, type: Number, description: "The associated task id" })
  taskId: number | null;

  @ApiProperty({ nullable: true, type: String })
  title: string | null;

  @ApiProperty({
    nullable: true,
    description: "Update request status for this project report",
    enum: UPDATE_REQUEST_STATUSES
  })
  updateRequestStatus: UpdateRequestStatus | null;

  @ApiProperty({ nullable: true, type: Date })
  dueAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ nullable: true, type: Number })
  pctSurvivalToDate: number | null;
}

export type ProjectReportMedia = Pick<ProjectReportFullDto, keyof typeof ProjectReport.MEDIA>;
type ProjectReportCalculated = "feedback" | "feedbackFields" | "paidOtherActivityDescription";

export class ProjectReportFullDto extends ProjectReportLightDto {
  constructor(
    projectReport: ProjectReport,
    props: HybridSupportProps<ProjectReportFullDto, Omit<ProjectReport, ProjectReportCalculated>>
  ) {
    super();
    populateDto<ProjectReportFullDto, ProjectReport>(this, projectReport, { lightResource: false, ...props });
  }

  @ApiProperty({ nullable: true, type: String })
  feedback: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  feedbackFields: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  localEngagementDescription: string | null;

  @ApiProperty({ nullable: true, type: String })
  equitableOpportunities: string | null;

  @ApiProperty({ nullable: true, type: String })
  resilienceProgress: string | null;

  @ApiProperty({ nullable: true, type: String })
  localGovernance: string | null;

  @ApiProperty({ nullable: true, type: String })
  adaptiveManagement: string | null;

  @ApiProperty({ nullable: true, type: String })
  scalabilityReplicability: string | null;

  @ApiProperty({ nullable: true, type: String })
  convergenceJobsDescription: string | null;

  @ApiProperty({ nullable: true, type: String })
  convergenceSchemes: string | null;

  @ApiProperty({ nullable: true, type: Number })
  convergenceAmount: number | null;

  @ApiProperty({ nullable: true, type: Number })
  beneficiariesScstobc: number | null;

  @ApiProperty({ nullable: true, type: Number })
  beneficiariesScstobcFarmers: number | null;

  @ApiProperty({ nullable: true, type: String })
  communityPartnersAssetsDescription: string | null;

  @ApiProperty({ nullable: true, type: Number })
  peopleKnowledgeSkillsIncreased: number | null;

  @ApiProperty({ nullable: true, type: String })
  technicalNarrative: string | null;

  @ApiProperty({ nullable: true, type: String })
  publicNarrative: string | null;

  @ApiProperty({ nullable: true, type: Number })
  totalUniqueRestorationPartners: number | null;

  @ApiProperty({ nullable: true, type: String })
  businessMilestones: string | null;

  @ApiProperty({ nullable: true, type: String })
  landscapeCommunityContribution: string | null;

  @ApiProperty({ nullable: true, type: String })
  reportTitle: string | null;

  @ApiProperty({ nullable: true, type: Number })
  seedsPlantedCount: number | null;

  @ApiProperty({ nullable: true, type: Number })
  treesPlantedCount: number | null;

  @ApiProperty()
  regeneratedTreesCount: number;

  @ApiProperty({ nullable: true, type: String })
  topThreeSuccesses: string | null;

  @ApiProperty({ nullable: true, type: String })
  challengesFaced: string | null;

  @ApiProperty({ nullable: true, type: String })
  lessonsLearned: string | null;

  @ApiProperty({ nullable: true, type: String })
  maintenanceAndMonitoringActivities: string | null;

  @ApiProperty({ nullable: true, type: String })
  significantChange: string | null;

  @ApiProperty({ nullable: true, type: String })
  survivalCalculation: string | null;

  @ApiProperty({ nullable: true, type: String })
  survivalComparison: string | null;

  @ApiProperty({ nullable: true, type: Number })
  ftSmallholderFarmers: number | null;

  @ApiProperty({ nullable: true, type: Number })
  ptSmallholderFarmers: number | null;

  @ApiProperty({ nullable: true, type: Number })
  seasonalMen: number | null;

  @ApiProperty({ nullable: true, type: Number })
  seasonalWomen: number | null;

  @ApiProperty({ nullable: true, type: Number })
  seasonalYouth: number | null;

  @ApiProperty({ nullable: true, type: Number })
  seasonalSmallholderFarmers: number | null;

  @ApiProperty({ nullable: true, type: Number })
  seasonalTotal: number | null;

  @ApiProperty({ nullable: true, type: Number })
  volunteerSmallholderFarmers: number | null;

  @ApiProperty()
  taskTotalWorkdays: number;

  @ApiProperty({ nullable: true, type: Number })
  plantedTrees: number | null;

  @ApiProperty({ nullable: true, type: String })
  sharedDriveLink: string | null;

  @ApiProperty({ nullable: true, type: String })
  beneficiariesDescription: string | null;

  @ApiProperty({ nullable: true, type: Number })
  beneficiariesIncomeIncrease: number | null;

  @ApiProperty({ nullable: true, type: String })
  beneficiariesIncomeIncreaseDescription: string | null;

  @ApiProperty({ nullable: true, type: String })
  beneficiariesSkillsKnowledgeIncreaseDescription: string | null;

  @ApiProperty({ nullable: true, type: Number })
  indirectBeneficiaries: number | null;

  @ApiProperty({ nullable: true, type: String })
  indirectBeneficiariesDescription: string | null;

  @ApiProperty({ nullable: true, type: String })
  newJobsDescription: string | null;

  @ApiProperty({ nullable: true, type: String })
  volunteersWorkDescription: string | null;

  @ApiProperty({ nullable: true, type: Number })
  siteReportsCount: number | null;

  @ApiProperty({ nullable: true, type: Number })
  nurseryReportsCount: number | null;

  @ApiProperty()
  seedlingsGrown: number;

  @ApiProperty({ nullable: true, type: String })
  communityProgress: string | null;

  @ApiProperty({ nullable: true, type: String })
  localEngagement: string | null;

  @ApiProperty({ nullable: true, type: String })
  plantingStatus: string | null;

  @ApiProperty()
  siteAddition: boolean;

  @ApiProperty({ nullable: true, type: String })
  paidOtherActivityDescription: string | null;

  @ApiProperty({ nullable: true, type: String })
  otherRestorationPartnersDescription: string | null;

  @ApiProperty({ nullable: true, type: Number })
  nonTreeTotal: number | null;

  @ApiProperty({ nullable: true, type: Number })
  createdBy: number | null;

  @ApiProperty({ nullable: true, type: String })
  createdByFirstName: string | null;

  @ApiProperty({ nullable: true, type: String })
  createdByLastName: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated task uuid"
  })
  taskUuid: string | null;

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
  baselineReportUpload: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  localGovernanceOrderLetterUpload: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  eventsMeetingsPhotos: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  localGovernanceProofOfPartnershipUpload: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  topThreeSuccessesUpload: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  directJobsUpload: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  convergenceJobsUpload: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  convergenceSchemesUpload: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  livelihoodActivitiesUpload: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  directLivelihoodImpactsUpload: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  certifiedDatabaseUpload: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  physicalAssetsPhotos: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  indirectCommunityPartnersUpload: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  trainingCapacityBuildingUpload: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  trainingCapacityBuildingPhotos: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  financialReportUpload: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  treePlantingUpload: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  soilWaterConservationUpload: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  soilWaterConservationPhotos: MediaDto[];
}

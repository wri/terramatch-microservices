import { ProjectReport } from "@terramatch-microservices/database/entities";
import { EntityDto, AdditionalProps } from "./entity.dto";
import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { JsonApiDto } from "@terramatch-microservices/common/decorators/json-api-dto.decorator";
import { ApiProperty } from "@nestjs/swagger";
import { MediaDto } from "./media.dto";
import { User } from "@sentry/nestjs";

@JsonApiDto({ type: "projectReports" })
export class ProjectReportLightDto extends EntityDto {
  constructor(projectReport?: ProjectReport) {
    super();
    if (projectReport != null) {
      this.populate(ProjectReportLightDto, {
        ...pickApiProperties(projectReport, ProjectReportLightDto),
        lightResource: true,
        // these two are untyped and marked optional in the base model.
        createdAt: projectReport.createdAt as Date,
        updatedAt: projectReport.createdAt as Date
      });
    }
  }

  @ApiProperty()
  frameworkKey: string | null;

  @ApiProperty({
    nullable: true,
    description: "The associated organisation name"
  })
  organisationName: string | null;

  @ApiProperty({
    nullable: true,
    description: "The associated organisation uuid"
  })
  organisationUuid: string | null;

  @ApiProperty({ nullable: true })
  projectName: string | null;

  @ApiProperty({ nullable: true })
  projectUuid: string | null;

  @ApiProperty()
  status: string;

  @ApiProperty({ nullable: true })
  submittedAt: Date | null;

  @ApiProperty({
    nullable: true,
    description: "The associated task uuid"
  })
  taskUuid: string | null;

  @ApiProperty({ nullable: true })
  title: string | null;

  @ApiProperty()
  updateRequestStatus: string;

  @ApiProperty()
  dueAt: Date | null;

  @ApiProperty()
  workdaysPaid: number | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export type AdditionalProjectReportFullProps = AdditionalProps<
  ProjectReportFullDto,
  ProjectReportLightDto & Omit<ProjectReport, "project">
>;
export type ProjectReportMedia = Pick<ProjectReportFullDto, keyof typeof ProjectReport.MEDIA>;

export class ProjectReportFullDto extends ProjectReportLightDto {
  constructor(projectReport: ProjectReport, props: AdditionalProjectReportFullProps) {
    super();
    this.populate(ProjectReportFullDto, {
      ...pickApiProperties(projectReport, ProjectReportFullDto),
      lightResource: false,
      // these two are untyped and marked optional in the base model.
      createdAt: projectReport.createdAt as Date,
      updatedAt: projectReport.createdAt as Date,
      ...props
    });
  }

  @ApiProperty({ nullable: true })
  status: string | null;

  @ApiProperty()
  updateRequestStatus: string;

  @ApiProperty({ nullable: true })
  feedback: string | null;

  @ApiProperty({ nullable: true })
  feedbackFields: string[] | null;

  @ApiProperty({ nullable: true })
  completion: number | null;

  @ApiProperty({ nullable: true })
  localEngagementDescription: string | null;

  @ApiProperty({ nullable: true })
  equitableOpportunities: string | null;

  @ApiProperty({ nullable: true })
  resilienceProgress: string | null;

  @ApiProperty({ nullable: true })
  localGovernance: string | null;

  @ApiProperty({ nullable: true })
  adaptiveManagement: string | null;

  @ApiProperty({ nullable: true })
  scalabilityReplicability: string | null;

  @ApiProperty({ nullable: true })
  convergenceJobsDescription: string | null;

  @ApiProperty({ nullable: true })
  convergenceSchemes: string | null;

  @ApiProperty({ nullable: true })
  convergenceAmount: number | null;

  @ApiProperty({ nullable: true })
  beneficiariesScstobc: number | null;

  @ApiProperty({ nullable: true })
  beneficiariesScstobcFarmers: number | null;

  @ApiProperty({ nullable: true })
  communityPartnersAssetsDescription: string | null;

  @ApiProperty({ nullable: true })
  peopleKnowledgeSkillsIncreased: number | null;

  @ApiProperty({ nullable: true })
  technicalNarrative: string | null;

  @ApiProperty({ nullable: true })
  publicNarrative: string | null;

  @ApiProperty({ nullable: true })
  totalUniqueRestorationPartners: number | null;

  @ApiProperty({ nullable: true })
  businessMilestones: string | null;

  @ApiProperty({ nullable: true })
  landscapeCommunityContribution: string | null;

  @ApiProperty({ nullable: true })
  reportTitle: string | null;

  @ApiProperty({ nullable: true })
  seedsPlantedCount: number | null;

  @ApiProperty({ nullable: true })
  treesPlantedCount: number | null;

  @ApiProperty()
  regeneratedTreesCount: number;

  @ApiProperty({ nullable: true })
  topThreeSuccesses: string | null;

  @ApiProperty({ nullable: true })
  challengesFaced: string | null;

  @ApiProperty({ nullable: true })
  lessonsLearned: string | null;

  @ApiProperty({ nullable: true })
  maintenanceAndMonitoringActivities: string | null;

  @ApiProperty({ nullable: true })
  significantChange: string | null;

  @ApiProperty({ nullable: true })
  pctSurvivalToDate: number | null;

  @ApiProperty({ nullable: true })
  survivalCalculation: string | null;

  @ApiProperty({ nullable: true })
  survivalComparison: string | null;

  @ApiProperty({ nullable: true })
  ftSmallholderFarmers: number | null;

  @ApiProperty({ nullable: true })
  ptSmallholderFarmers: number | null;

  @ApiProperty({ nullable: true })
  seasonalMen: number | null;

  @ApiProperty({ nullable: true })
  seasonalWomen: number | null;

  @ApiProperty({ nullable: true })
  seasonalYouth: number | null;

  @ApiProperty({ nullable: true })
  seasonalSmallholderFarmers: number | null;

  @ApiProperty({ nullable: true })
  seasonalTotal: number | null;

  @ApiProperty({ nullable: true })
  volunteerSmallholderFarmers: number | null;

  @ApiProperty({ nullable: true })
  plantedTrees: number | null;

  @ApiProperty({ nullable: true })
  sharedDriveLink: string | null;

  @ApiProperty({ nullable: true })
  beneficiariesDescription: string | null;

  @ApiProperty({ nullable: true })
  beneficiariesIncomeIncrease: number | null;

  @ApiProperty({ nullable: true })
  beneficiariesIncomeIncreaseDescription: string | null;

  @ApiProperty({ nullable: true })
  beneficiariesSkillsKnowledgeIncreaseDescription: string | null;

  @ApiProperty({ nullable: true })
  indirectBeneficiaries: number | null;

  @ApiProperty({ nullable: true })
  indirectBeneficiariesDescription: string | null;

  @ApiProperty({ nullable: true })
  newJobsDescription: string | null;

  @ApiProperty({ nullable: true })
  volunteersWorkDescription: string | null;

  @ApiProperty({ nullable: true })
  siteReportsCount: number | null;

  @ApiProperty({ nullable: true })
  nurseryReportsCount: number | null;

  @ApiProperty()
  seedlingsGrown: number;

  @ApiProperty({ nullable: true })
  communityProgress: string | null;

  @ApiProperty({ nullable: true })
  localEngagement: string | null;

  @ApiProperty()
  siteAddition: boolean;

  @ApiProperty({ nullable: true })
  paidOtherActivityDescription: string | null;

  @ApiProperty({ nullable: true })
  nonTreeTotal: number | null;

  @ApiProperty()
  readableCompletionStatus: string;

  @ApiProperty({ nullable: true })
  createdBy: number | null;

  @ApiProperty({ nullable: true })
  createdByUser: User | null;

  @ApiProperty({
    nullable: true,
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
}

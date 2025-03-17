import { ProjectReport } from "@terramatch-microservices/database/entities";
import { EntityDto, AdditionalProps } from "./entity.dto";
import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { JsonApiDto } from "@terramatch-microservices/common/decorators/json-api-dto.decorator";
import { ApiProperty } from "@nestjs/swagger";
import { MediaDto } from "./media.dto";

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

  @ApiProperty()
  frameworkUuid: string | null;

  @ApiProperty({
    nullable: true,
    description: "The associated organisation name"
  })
  organisationName: string | null;

  @ApiProperty({ nullable: true })
  projectName: string | null;

  @ApiProperty({ nullable: true })
  projectUuid: string | null;

  @ApiProperty()
  status: string;

  @ApiProperty({ nullable: true })
  submittedAt: Date | null;

  @ApiProperty({ nullable: true })
  taskId: number | null;

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

// export type AdditionalProjectReportLightProps = Pick<ProjectReportLightDto, "treesPlantedCount">;
export type AdditionalProjectReportFullProps =
  /*AdditionalProjectReportLightProps &*/
  AdditionalProps<ProjectReportFullDto, ProjectReportLightDto & Omit<ProjectReport, "project">>;
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

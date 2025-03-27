import { SiteReport } from "@terramatch-microservices/database/entities";
import { EntityDto, AdditionalProps } from "./entity.dto";
import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { JsonApiDto } from "@terramatch-microservices/common/decorators/json-api-dto.decorator";
import { ApiProperty } from "@nestjs/swagger";
import { MediaDto } from "./media.dto";
import { User } from "@sentry/nestjs";
import { ProjectReportLightDto } from "./project-report.dto";

@JsonApiDto({ type: "siteReports" })
export class SiteReportLightDto extends EntityDto {
  constructor(siteReport?: SiteReport, props?: AdditionalSiteReportLightProps) {
    super();
    if (siteReport != null) {
      this.populate(SiteReportLightDto, {
        ...pickApiProperties(siteReport, SiteReportLightDto),
        lightResource: true,
        // these two are untyped and marked optional in the base model.
        createdAt: siteReport.createdAt as Date,
        updatedAt: siteReport.updatedAt as Date,
        ...props
      });
    }
  }

  @ApiProperty({
    nullable: true,
    description: "The associated site name"
  })
  siteName: string | null;

  @ApiProperty({
    nullable: true,
    description: "The associated site uuid"
  })
  siteUuid: string | null;

  @ApiProperty()
  frameworkKey: string | null;

  @ApiProperty()
  frameworkUuid: string | null;

  @ApiProperty()
  status: string;

  @ApiProperty()
  updateRequestStatus: string;

  @ApiProperty({
    nullable: true,
    description: "The associated project name"
  })
  projectName: string | null;

  @ApiProperty({
    nullable: true,
    description: "The associated project uuid"
  })
  projectUuid: string | null;

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

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ nullable: true })
  submittedAt: Date | null;

  @ApiProperty({ nullable: true })
  taskUuid: string | null;

  @ApiProperty()
  dueAt: Date | null;

  @ApiProperty({ nullable: true })
  reportTitle: string | null;

  @ApiProperty()
  createdAt: Date;
}

export type AdditionalSiteReportLightProps = Pick<SiteReportLightDto, "reportTitle">;
export type AdditionalSiteReportFullProps = AdditionalSiteReportLightProps &
  AdditionalProps<SiteReportFullDto, SiteReportLightDto & Omit<SiteReport, "site">>;
export type SiteReportMedia = Pick<SiteReportFullDto, keyof typeof SiteReport.MEDIA>;

export class SiteReportFullDto extends SiteReportLightDto {
  constructor(siteReport: SiteReport, props?: AdditionalSiteReportFullProps) {
    super();
    this.populate(SiteReportFullDto, {
      ...pickApiProperties(siteReport, SiteReportFullDto),
      lightResource: false,
      // these two are untyped and marked optional in the base model.
      createdAt: siteReport.createdAt as Date,
      updatedAt: siteReport.updatedAt as Date,
      ...props
    });
  }

  @ApiProperty({ nullable: true })
  reportTitle: string | null;

  @ApiProperty({ nullable: true })
  projectReportTitle: string | null;

  @ApiProperty({
    nullable: true,
    description: "The associated site name"
  })
  siteName: string | null;

  @ApiProperty({
    nullable: true,
    description: "The associated site uuid"
  })
  siteUuid: string | null;

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

  @ApiProperty()
  dueAt: Date | null;

  @ApiProperty()
  status: string;

  @ApiProperty()
  updateRequestStatus: string;

  @ApiProperty({ nullable: true })
  feedback: string | null;

  @ApiProperty({ nullable: true })
  feedbackFields: string[] | null;

  @ApiProperty()
  nothingToReport: boolean;

  @ApiProperty()
  readableCompletionStatus: string;

  @ApiProperty({ nullable: true })
  title: string | null;

  @ApiProperty({ nullable: true })
  sharedDriveLink: string | null;

  @ApiProperty({ nullable: true })
  createdByUser: User | null;

  @ApiProperty({ nullable: true })
  approvedByUser: User | null;

  @ApiProperty({
    nullable: true,
    description: "The associated project name"
  })
  projectName: string | null;

  @ApiProperty({
    nullable: true,
    description: "The associated project uuid"
  })
  projectUuid: string | null;

  @ApiProperty({
    nullable: true,
    description: "The associated task uuid"
  })
  taskUuid: string | null;

  @ApiProperty({ nullable: true })
  submittedAt: Date | null;

  @ApiProperty()
  migrated: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ nullable: true })
  numTreesRegenerating: number | null;

  @ApiProperty({ nullable: true })
  regenerationDescription: string | null;

  @ApiProperty({ nullable: true })
  invasiveSpeciesRemoved: string | null;

  @ApiProperty({ nullable: true })
  invasiveSpeciesManagement: string | null;

  @ApiProperty({ nullable: true })
  siteCommunityPartnersDescription: string | null;

  @ApiProperty({ nullable: true })
  siteCommunityPartnersIncomeIncreaseDescription: string | null;

  @ApiProperty({ nullable: true })
  soilWaterRestorationDescription: string | null;

  @ApiProperty({ nullable: true })
  waterStructures: string | null;

  @ApiProperty({ nullable: true })
  disturbanceDetails: string | null;

  @ApiProperty({ nullable: true })
  paidOtherActivityDescription: string | null;

  @ApiProperty({ nullable: true })
  polygonStatus: string | null;

  @ApiProperty()
  totalNonTreeSpeciesPlantedCount: number | null;

  @ApiProperty()
  totalTreeReplantingCount: number | null;

  @ApiProperty()
  totalTreesPlantedCount: number | null;

  @ApiProperty()
  totalSeedsPlantedCount: number | null;

  @ApiProperty()
  survivalCalculation: string | null;

  @ApiProperty()
  survivalDescription: string | null;

  @ApiProperty()
  maintenanceActivities: string | null;

  @ApiProperty()
  technicalNarrative: string | null;

  @ApiProperty()
  publicNarrative: string | null;

  @ApiProperty()
  pctSurvivalToDate: number | null;

  @ApiProperty({ nullable: true })
  projectReport: ProjectReportLightDto | null;

  @ApiProperty({ type: () => MediaDto, isArray: true })
  socioeconomicBenefits: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  media: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  file: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  otherAdditionalDocuments: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  photos: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  treeSpecies: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  siteSubmission: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  documentFiles: MediaDto[];
}

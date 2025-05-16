import { SiteReport } from "@terramatch-microservices/database/entities";
import { EntityDto } from "./entity.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { JsonApiDto } from "@terramatch-microservices/common/decorators/json-api-dto.decorator";
import { ApiProperty } from "@nestjs/swagger";
import { MediaDto } from "./media.dto";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";

@JsonApiDto({ type: "siteReports" })
export class SiteReportLightDto extends EntityDto {
  constructor(siteReport?: SiteReport, props?: HybridSupportProps<SiteReportLightDto, SiteReport>) {
    super();
    if (siteReport != null && props != null) {
      populateDto<SiteReportLightDto, SiteReport>(this, siteReport, { lightResource: true, ...props });
    }
  }

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated site name"
  })
  siteName: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated site uuid"
  })
  siteUuid: string | null;

  @ApiProperty({ nullable: true, type: String })
  frameworkKey: string | null;

  @ApiProperty()
  status: string;

  @ApiProperty()
  updateRequestStatus: string;

  @ApiProperty({ nullable: true, type: Number })
  completion: number | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated project name"
  })
  projectName: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated project uuid"
  })
  projectUuid: string | null;

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

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ nullable: true, type: Date })
  submittedAt: Date | null;

  @ApiProperty({ nullable: true, type: String })
  taskUuid: string | null;

  @ApiProperty({ nullable: true, type: Date })
  dueAt: Date | null;

  @ApiProperty({ nullable: true, type: String })
  reportTitle: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ nullable: true, type: Boolean })
  nothingToReport: boolean | null;
}

export type SiteReportMedia = Pick<SiteReportFullDto, keyof typeof SiteReport.MEDIA>;

export class SiteReportFullDto extends SiteReportLightDto {
  constructor(siteReport: SiteReport, props: HybridSupportProps<SiteReportFullDto, SiteReport>) {
    super();
    populateDto<SiteReportFullDto, SiteReport>(this, siteReport, { lightResource: false, ...props });
  }

  @ApiProperty({ nullable: true, type: String })
  reportTitle: string | null;

  @ApiProperty({ nullable: true, type: String })
  projectReportTitle: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated site name"
  })
  siteName: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated site uuid"
  })
  siteUuid: string | null;

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

  @ApiProperty({ nullable: true, type: Date })
  dueAt: Date | null;

  @ApiProperty()
  status: string;

  @ApiProperty()
  updateRequestStatus: string;

  @ApiProperty({ nullable: true, type: String })
  feedback: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  feedbackFields: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  title: string | null;

  @ApiProperty({ nullable: true, type: String })
  sharedDriveLink: string | null;

  @ApiProperty({ nullable: true, type: String })
  createdByFirstName: string | null;

  @ApiProperty({ nullable: true, type: String })
  createdByLastName: string | null;

  @ApiProperty({ nullable: true, type: String })
  approvedByFirstName: string | null;

  @ApiProperty({ nullable: true, type: String })
  approvedByLastName: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated project name"
  })
  projectName: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated project uuid"
  })
  projectUuid: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated task uuid"
  })
  taskUuid: string | null;

  @ApiProperty({ nullable: true, type: Date })
  submittedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ nullable: true, type: Number })
  numTreesRegenerating: number | null;

  @ApiProperty({ nullable: true, type: String })
  regenerationDescription: string | null;

  @ApiProperty({ nullable: true, type: String })
  invasiveSpeciesRemoved: string | null;

  @ApiProperty({ nullable: true, type: String })
  invasiveSpeciesManagement: string | null;

  @ApiProperty({ nullable: true, type: String })
  siteCommunityPartnersDescription: string | null;

  @ApiProperty({ nullable: true, type: String })
  siteCommunityPartnersIncomeIncreaseDescription: string | null;

  @ApiProperty({ nullable: true, type: String })
  soilWaterRestorationDescription: string | null;

  @ApiProperty({ nullable: true, type: String })
  waterStructures: string | null;

  @ApiProperty({ nullable: true, type: String })
  disturbanceDetails: string | null;

  @ApiProperty({ nullable: true, type: String })
  paidOtherActivityDescription: string | null;

  @ApiProperty({ nullable: true, type: String })
  polygonStatus: string | null;

  @ApiProperty({ nullable: true, type: Number })
  totalNonTreeSpeciesPlantedCount: number | null;

  @ApiProperty({ nullable: true, type: Number })
  totalTreeReplantingCount: number | null;

  @ApiProperty({ nullable: true, type: Number })
  totalTreesPlantedCount: number | null;

  @ApiProperty({ nullable: true, type: Number })
  totalSeedsPlantedCount: number | null;

  @ApiProperty({ nullable: true, type: String })
  survivalCalculation: string | null;

  @ApiProperty({ nullable: true, type: String })
  survivalDescription: string | null;

  @ApiProperty({ nullable: true, type: String })
  maintenanceActivities: string | null;

  @ApiProperty({ nullable: true, type: String })
  technicalNarrative: string | null;

  @ApiProperty({ nullable: true, type: String })
  publicNarrative: string | null;

  @ApiProperty({ nullable: true, type: Number })
  pctSurvivalToDate: number | null;

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

  @ApiProperty({ type: () => MediaDto, isArray: true })
  treePlantingUpload: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  anrPhotos: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  soilWaterConservationUpload: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  soilWaterConservationPhotos: MediaDto[];
}

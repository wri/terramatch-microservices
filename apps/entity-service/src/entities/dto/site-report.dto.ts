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
    if (siteReport != null) {
      populateDto<SiteReportLightDto, SiteReport>(this, siteReport, { lightResource: true, ...props });
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
  status: string;

  @ApiProperty()
  updateRequestStatus: string;

  @ApiProperty({ nullable: true })
  completion: number | null;

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

  @ApiProperty({ nullable: true })
  nothingToReport: boolean | null;
}

export type SiteReportMedia = Pick<SiteReportFullDto, keyof typeof SiteReport.MEDIA>;

export class SiteReportFullDto extends SiteReportLightDto {
  constructor(siteReport: SiteReport, props: HybridSupportProps<SiteReportFullDto, SiteReport>) {
    super();
    populateDto<SiteReportFullDto, SiteReport>(this, siteReport, { lightResource: false, ...props });
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

  @ApiProperty({ nullable: true })
  title: string | null;

  @ApiProperty({ nullable: true })
  sharedDriveLink: string | null;

  @ApiProperty({ nullable: true })
  createdByFirstName: string | null;

  @ApiProperty({ nullable: true })
  createdByLastName: string | null;

  @ApiProperty({ nullable: true })
  approvedByFirstName: string | null;

  @ApiProperty({ nullable: true })
  approvedByLastName: string | null;

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

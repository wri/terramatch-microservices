import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import {
  ENTITY_STATUSES,
  EntityStatus,
  UPDATE_REQUEST_STATUSES,
  UpdateRequestStatus
} from "@terramatch-microservices/database/constants/status";
import { ApiProperty } from "@nestjs/swagger";
import { Site } from "@terramatch-microservices/database/entities";
import { EntityDto } from "./entity.dto";
import { MediaDto } from "./media.dto";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";

@JsonApiDto({ type: "sites" })
export class SiteLightDto extends EntityDto {
  constructor(site?: Site, props?: HybridSupportProps<SiteLightDto, Site>) {
    super();
    if (site != null && props != null) {
      populateDto<SiteLightDto, Site>(this, site, { lightResource: true, ...props });
    }
  }

  @ApiProperty({ nullable: true, type: String, description: "Framework key for this project" })
  frameworkKey: string | null;

  @ApiProperty({
    nullable: true,
    description: "Entity status for this site",
    enum: ENTITY_STATUSES
  })
  status: EntityStatus | null;

  @ApiProperty({
    nullable: true,
    description: "Update request status for this site",
    enum: UPDATE_REQUEST_STATUSES
  })
  updateRequestStatus: UpdateRequestStatus | null;

  @ApiProperty({ nullable: true, type: String })
  name: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated project name"
  })
  projectName: string | null;

  @ApiProperty()
  treesPlantedCount: number;

  @ApiProperty({ nullable: true })
  hectaresToRestoreGoal: number;

  @ApiProperty()
  totalHectaresRestoredSum: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export type SiteMedia = Pick<SiteFullDto, keyof typeof Site.MEDIA>;

export class SiteFullDto extends SiteLightDto {
  constructor(site: Site, props: HybridSupportProps<SiteFullDto, Site>) {
    super();
    populateDto<SiteLightDto, Site>(this, site, { lightResource: false, ...props });
  }

  @ApiProperty()
  totalSiteReports: number;

  @ApiProperty()
  totalHectaresRestoredSum: number;

  @ApiProperty()
  seedsPlantedCount: number;

  @ApiProperty()
  overdueSiteReportsTotal: number;

  @ApiProperty()
  selfReportedWorkdayCount: number;

  @ApiProperty()
  regeneratedTreesCount: number;

  @ApiProperty()
  combinedWorkdayCount: number;

  @ApiProperty()
  workdayCount: number;

  @ApiProperty({ nullable: true, type: Number })
  ppcExternalId: number | null;

  @ApiProperty({ nullable: true })
  sitingStrategy: string;

  @ApiProperty({ nullable: true, type: String })
  descriptionSitingStrategy: string | null;

  @ApiProperty({ nullable: true })
  hectaresToRestoreGoal: number;

  @ApiProperty({ nullable: true, type: String })
  description: string | null;

  @ApiProperty({ nullable: true, type: Boolean })
  controlSite: boolean | null;

  @ApiProperty({ nullable: true, type: String })
  history: string | null;

  @ApiProperty({ nullable: true, type: Date })
  startDate: Date | null;

  @ApiProperty({ nullable: true, type: Date })
  endDate: Date | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  landTenures: string[] | null;

  @ApiProperty({ nullable: true, type: Number })
  survivalRatePlanted: number | null;

  @ApiProperty({ nullable: true, type: Number })
  directSeedingSurvivalRate: number | null;

  @ApiProperty({ nullable: true, type: Number })
  aNatRegenerationTreesPerHectare: number | null;

  @ApiProperty({ nullable: true, type: Number })
  aNatRegeneration: number | null;

  @ApiProperty({ nullable: true, type: String })
  landscapeCommunityContribution: string | null;

  @ApiProperty({ nullable: true, type: String })
  technicalNarrative: string | null;

  @ApiProperty({ nullable: true, type: String })
  plantingPattern: string | null;

  @ApiProperty({ nullable: true, type: String })
  soilCondition: string | null;

  @ApiProperty({ nullable: true, type: Number })
  aimYearFiveCrownCover: number | null;

  @ApiProperty({ nullable: true, type: Number })
  aimNumberOfMatureTrees: number | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  landUseTypes: string[] | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  restorationStrategy: string[] | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  anrPractices: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  feedback: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  feedbackFields: string[] | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  detailedInterventionTypes: string[] | null;

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
  treeSpecies: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  documentFiles: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: false })
  stratificationForHeterogeneity: MediaDto;

  @ApiProperty({
    nullable: true,
    description: "The associated project uuid"
  })
  projectUuid: string;

  @ApiProperty({
    nullable: true,
    description: "The associated project country"
  })
  projectCountry: string;

  @ApiProperty({
    nullable: true,
    description: "The associated project organisation name"
  })
  organisationName: string;
}

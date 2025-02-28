import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import {
  SITE_STATUSES,
  SiteStatus,
  UPDATE_REQUEST_STATUSES,
  UpdateRequestStatus
} from "@terramatch-microservices/database/constants/status";
import { ApiProperty } from "@nestjs/swagger";
import { Site } from "@terramatch-microservices/database/entities";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { AdditionalProps, EntityDto } from "./entity.dto";
import { MediaDto } from "./media.dto";

@JsonApiDto({ type: "sites" })
export class SiteLightDto extends EntityDto {
  constructor(site?: Site) {
    super();
    if (site != null) {
      this.populate(SiteLightDto, {
        ...pickApiProperties(site, SiteLightDto),
        lightResource: true,
        // these two are untyped and marked optional in the base model.
        createdAt: site.createdAt as Date,
        updatedAt: site.createdAt as Date
      });
    }
  }

  @ApiProperty({ nullable: true, description: "Framework key for this project" })
  frameworkKey: FrameworkKey | null;

  @ApiProperty({
    nullable: true,
    description: "Framework UUID. Will be removed after the FE is refactored to not use these IDs",
    deprecated: true
  })
  frameworkUuid: string | null;

  @ApiProperty({
    nullable: true,
    description: "Entity status for this project",
    enum: SITE_STATUSES
  })
  status: SiteStatus | null;

  @ApiProperty({
    nullable: true,
    description: "Update request status for this project",
    enum: UPDATE_REQUEST_STATUSES
  })
  updateRequestStatus: UpdateRequestStatus | null;

  @ApiProperty({ nullable: true })
  name: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export type AdditionalSiteFullProps = AdditionalProps<SiteFullDto, SiteLightDto, Site>;
export type SiteMedia = Pick<SiteFullDto, keyof typeof Site.MEDIA>;

export class SiteFullDto extends SiteLightDto {
  constructor(site: Site, props: AdditionalSiteFullProps) {
    super();
    this.populate(SiteFullDto, {
      ...pickApiProperties(site, SiteFullDto),
      lightResource: false,
      createdAt: site.createdAt as Date,
      updatedAt: site.updatedAt as Date,
      ...props
    });
  }

  @ApiProperty({
    type: Boolean,
    example: false,
    description: "Indicates that this resource has the full resource definition."
  })
  lightResource = false;

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
  treesPlantedCount: number;

  @ApiProperty()
  regeneratedTreesCount: number;

  @ApiProperty()
  combinedWorkdayCount: number;

  @ApiProperty()
  workdayCount: number;

  @ApiProperty({ nullable: true })
  ppcExternalId: number | null;

  @ApiProperty({ nullable: true })
  sitingStrategy: string;

  @ApiProperty({ nullable: true })
  descriptionSitingStrategy: string | null;

  @ApiProperty({ nullable: true })
  hectaresToRestoreGoal: number;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ nullable: true })
  controlSite: boolean | null;

  @ApiProperty({ nullable: true })
  history: string | null;

  @ApiProperty({ nullable: true })
  startDate: Date | null;

  @ApiProperty({ nullable: true })
  endDate: Date | null;

  @ApiProperty({ nullable: true })
  landTenures: string[] | null;

  @ApiProperty({ nullable: true })
  survivalRatePlanted: number | null;

  @ApiProperty({ nullable: true })
  directSeedingSurvivalRate: number | null;

  @ApiProperty({ nullable: true })
  aNatRegenerationTreesPerHectare: number | null;

  @ApiProperty({ nullable: true })
  aNatRegeneration: number | null;

  @ApiProperty({ nullable: true })
  landscapeCommunityContribution: string | null;

  @ApiProperty({ nullable: true })
  technicalNarrative: string | null;

  @ApiProperty({ nullable: true })
  plantingPattern: string | null;

  @ApiProperty({ nullable: true })
  soilCondition: string | null;

  @ApiProperty({ nullable: true })
  aimYearFiveCrownCover: number | null;

  @ApiProperty({ nullable: true })
  aimNumberOfMatureTrees: number | null;

  @ApiProperty({ nullable: true })
  landUseTypes: string[] | null;

  @ApiProperty({ nullable: true })
  restorationStrategy: string[] | null;

  @ApiProperty({ nullable: true })
  feedback: string | null;

  @ApiProperty({ nullable: true })
  feedbackFields: string[] | null;

  @ApiProperty({ nullable: true })
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
    description: "The associated project name"
  })
  projectName: string | null;
}

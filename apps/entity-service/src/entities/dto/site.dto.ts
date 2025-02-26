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
import { ProjectLightDto } from "./project.dto";
// TODO: THIS IS A STUB!

@JsonApiDto({ type: "sites" })
export class SiteLightDto extends EntityDto {
  constructor(site?: Site) {
    super();
    if (site != null) {
      this.populate(SiteLightDto, {
        ...pickApiProperties(site, SiteLightDto),
        project: site.project ? new ProjectLightDto(site.project) : undefined,
        ppcExternalId: site.ppcExternalId?.toString(),
        lightResource: true,
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

  @ApiProperty({ nullable: false, description: "Project" })
  project: ProjectLightDto;

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

  @ApiProperty({
    nullable: true,
    description: "The associated project name"
  })
  projectName: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  ppcExternalId: string;
}

export type AdditionalSiteFullProps = AdditionalProps<SiteFullDto, SiteLightDto, Site>;
export type SiteMedia = Pick<SiteFullDto, keyof typeof Site.MEDIA>;

export class SiteFullDto extends SiteLightDto {
  constructor(site: Site, props: AdditionalSiteFullProps) {
    super();
    this.populate(SiteFullDto, {
      ...pickApiProperties(site, SiteFullDto),
      project: site.project ? new ProjectLightDto(site.project) : undefined,
      ppcExternalId: site.ppcExternalId?.toString(),
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
  siteReportsTotal: number;

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
  approvedRegeneratedTreesCount: number;

  @ApiProperty()
  combinedWorkdayCount: number;

  @ApiProperty()
  workdayCount: number;

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

  @ApiProperty()
  ppcExternalId: string;
}

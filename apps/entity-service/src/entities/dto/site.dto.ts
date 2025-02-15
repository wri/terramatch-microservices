import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import {
  ENTITY_STATUSES,
  EntityStatus,
  UPDATE_REQUEST_STATUSES,
  UpdateRequestStatus
} from "@terramatch-microservices/database/constants/status";
import { ApiProperty } from "@nestjs/swagger";
import { Site } from "@terramatch-microservices/database/entities";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { AdditionalProps, EntityDto } from "./entity.dto";

// TODO: THIS IS A STUB!

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

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export type AdditionalSiteFullProps = AdditionalProps<SiteFullDto, SiteLightDto, Site>;

export class SiteFullDto extends SiteLightDto {
  constructor(site: Site, props: AdditionalSiteFullProps) {
    super();
    this.populate(SiteFullDto, {
      ...pickApiProperties(site, SiteFullDto),
      lightResource: false,
      // these two are untyped and marked optional in the base model.
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
}

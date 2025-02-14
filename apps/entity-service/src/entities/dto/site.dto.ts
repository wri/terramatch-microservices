import { JsonApiAttributes, pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
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

// TODO: THIS IS A STUB!

class SiteDtoBase<T> extends JsonApiAttributes<Omit<T, "lightResource">> {
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

@JsonApiDto({ type: "sites" })
export class SiteLightDto extends SiteDtoBase<SiteLightDto> {
  constructor(site: Site) {
    super({
      ...pickApiProperties(site as Omit<Site, "lightResource">, SiteLightDto),
      // these two are untyped and marked optional in the base model.
      createdAt: site.createdAt as Date,
      updatedAt: site.updatedAt as Date
    });
  }

  @ApiProperty({
    type: Boolean,
    example: true,
    description: "Indicates that this resource does not have the full resource definition."
  })
  lightResource = true;
}

// Incomplete stub
export type AdditionalSiteFullProps = {
  totalSiteReports: number;
};

@JsonApiDto({ type: "sites" })
export class SiteFullDto extends SiteDtoBase<SiteFullDto> {
  constructor(site: Site, props: AdditionalSiteFullProps) {
    super({
      ...pickApiProperties(site as Omit<Site, "lightResource" | keyof AdditionalSiteFullProps>, SiteFullDto),
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

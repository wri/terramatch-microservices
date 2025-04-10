import { ApiProperty } from "@nestjs/swagger";
import { ENTITY_STATUSES, SITE_STATUSES } from "@terramatch-microservices/database/constants/status";
import { IsBoolean, IsIn, IsOptional } from "class-validator";
import { JsonApiDataDto, JsonApiMultiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

class EntityUpdateAttributes {
  @IsOptional()
  @IsIn(ENTITY_STATUSES)
  @ApiProperty({
    description: "Request to change to the status of the given entity",
    nullable: true,
    enum: ENTITY_STATUSES
  })
  status?: string | null;
}

class ProjectUpdateAttributes extends EntityUpdateAttributes {
  @IsOptional()
  @IsBoolean()
  @ApiProperty({ description: "Update the isTest flag.", nullable: true })
  isTest?: boolean;
}

class ProjectData extends JsonApiDataDto({ type: "projects" }, ProjectUpdateAttributes) {}

// Temporary stub while implementing projects
class SiteUpdateAttributes extends EntityUpdateAttributes {
  @IsOptional()
  @IsIn(SITE_STATUSES)
  @ApiProperty({
    description: "Request to change to the status of the given entity",
    nullable: true,
    enum: SITE_STATUSES
  })
  status?: string | null;
}

class SiteData extends JsonApiDataDto({ type: "sites" }, SiteUpdateAttributes) {}

export class EntityUpdateBody extends JsonApiMultiBodyDto([ProjectData, SiteData] as const) {}

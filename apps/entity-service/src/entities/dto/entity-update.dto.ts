import { ApiProperty } from "@nestjs/swagger";
import { ENTITY_STATUSES, SITE_STATUSES } from "@terramatch-microservices/database/constants/status";
import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from "class-validator";
import { JsonApiDataDto, JsonApiMultiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { Type } from "class-transformer";

export class EntityUpdateAttributes {
  @IsOptional()
  @IsIn(ENTITY_STATUSES)
  @ApiProperty({
    description: "Request to change to the status of the given entity",
    nullable: true,
    enum: ENTITY_STATUSES
  })
  status?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: "Specific feedback for the PD", nullable: true })
  feedback?: string | null;

  @IsOptional()
  @IsArray()
  @Type(() => String)
  @ApiProperty({
    isArray: true,
    type: String,
    description: "The fields in the entity form that need attention from the PD",
    nullable: true
  })
  feedbackFields?: string[] | null;
}

export class ProjectUpdateAttributes extends EntityUpdateAttributes {
  @IsOptional()
  @IsBoolean()
  @ApiProperty({ description: "Update the isTest flag.", nullable: true })
  isTest?: boolean;
}

export class ProjectUpdateData extends JsonApiDataDto({ type: "projects" }, ProjectUpdateAttributes) {}

export class SiteUpdateAttributes extends EntityUpdateAttributes {
  @IsOptional()
  @IsIn(SITE_STATUSES)
  @ApiProperty({
    description: "Request to change to the status of the given entity",
    nullable: true,
    enum: SITE_STATUSES
  })
  status?: string | null;
}

// These are stubs, and most will need updating as we add support for these entity types
export class NurseryUpdateData extends JsonApiDataDto({ type: "nurseries" }, EntityUpdateAttributes) {}
export class ProjectReportUpdateData extends JsonApiDataDto({ type: "projectReports" }, EntityUpdateAttributes) {}
export class SiteReportUpdateData extends JsonApiDataDto({ type: "siteReports" }, EntityUpdateAttributes) {}
export class NurseryReportUpdateData extends JsonApiDataDto({ type: "nurseryReports" }, EntityUpdateAttributes) {}

export class SiteUpdateData extends JsonApiDataDto({ type: "sites" }, SiteUpdateAttributes) {}

export type EntityUpdateData = ProjectUpdateAttributes | SiteUpdateAttributes | EntityUpdateAttributes;
export class EntityUpdateBody extends JsonApiMultiBodyDto([ProjectUpdateData, SiteUpdateData] as const) {}

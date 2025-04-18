import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsDate, IsEnum, IsOptional, ValidateNested } from "class-validator";
import {
  INDICATOR_SLUGS,
  IndicatorSlug,
  POLYGON_STATUSES,
  PolygonStatus
} from "@terramatch-microservices/database/constants";
import { CursorPage, NumberPage, Page } from "@terramatch-microservices/common/dto/page.dto";
import { Transform, Type } from "class-transformer";
import { LandscapeGeometry } from "@terramatch-microservices/database/entities";
import { LandscapeSlug } from "@terramatch-microservices/database/types/landscapeGeometry";

export class SitePolygonQueryDto extends IntersectionType(CursorPage, NumberPage) {
  @ApiProperty({
    enum: POLYGON_STATUSES,
    name: "polygonStatus[]",
    isArray: true,
    required: false,
    description: "Filter results by polygon status"
  })
  @IsOptional()
  @IsArray()
  polygonStatus?: PolygonStatus[];

  @ApiProperty({
    name: "projectId[]",
    isArray: true,
    required: false,
    description: "Filter results by project UUID(s). May not be used with siteId[], projectCohort or landscape"
  })
  @IsOptional()
  @IsArray()
  projectId?: string[];

  @ApiProperty({
    name: "siteId[]",
    isArray: true,
    required: false,
    description: "Filter results by site UUID(s). May not be used with projectId[], projectCohort or landscape"
  })
  @IsOptional()
  @IsArray()
  siteId?: string[];

  @ApiProperty({
    name: "projectCohort",
    required: false,
    description: "Filter results by project cohort. May not be used with projectId[] or siteId[]"
  })
  @IsOptional()
  projectCohort?: string;

  @ApiProperty({
    required: false,
    description: "Filter results by project landscape. May not be used with projectId[] or siteId[]",
    enum: LandscapeGeometry.LANDSCAPE_SLUGS
  })
  @IsOptional()
  @IsEnum(LandscapeGeometry.LANDSCAPE_SLUGS)
  landscape?: LandscapeSlug;

  @ApiProperty({
    enum: INDICATOR_SLUGS,
    name: "missingIndicator[]",
    isArray: true,
    required: false,
    description: "Filter results by polygons that are missing at least one of the indicators listed"
  })
  @IsOptional()
  @IsArray()
  missingIndicator?: IndicatorSlug[];

  @ApiProperty({
    enum: INDICATOR_SLUGS,
    name: "presentIndicator[]",
    isArray: true,
    required: false,
    description: "Filter results by polygons that have all of the indicators listed"
  })
  @IsOptional()
  @IsArray()
  presentIndicator?: IndicatorSlug[];

  @ApiProperty({
    required: false,
    description: "Filter results by polygons that have been modified since the date provided"
  })
  @IsOptional()
  @IsDate()
  lastModifiedDate?: Date;

  @ApiProperty({
    required: false,
    default: false,
    type: "boolean",
    description: "Include polygons for test projects in the results."
  })
  @IsBoolean()
  @Transform(({ value }) => (value === "true" ? true : value === "false" ? false : undefined))
  includeTestProjects? = false;

  @ValidateNested()
  @Type(({ object }) => {
    // Surprisingly, the object here is the whole query DTO.
    const keys = Object.keys(object.page ?? {});
    if (keys.includes("after")) return CursorPage;
    if (keys.includes("number")) return NumberPage;
    return Page;
  })
  @IsOptional()
  page?: CursorPage | NumberPage;

  @ApiProperty({ required: false })
  @IsOptional()
  search?: string;

  @ApiProperty({
    required: false,
    default: false,
    type: "boolean",
    description: "Whether to include the complete sitePolygon Dto or not"
  })
  @IsBoolean()
  @Transform(({ value }) => (value === "true" ? true : value === "false" ? false : undefined))
  lightResource? = false;
}

import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsDate, IsEnum, IsIn, IsOptional, ValidateNested } from "class-validator";
import {
  INDICATOR_SLUGS,
  IndicatorSlug,
  POLYGON_STATUSES,
  PolygonStatus,
  SITE_POLYGON_DISTRIBUTIONS,
  SITE_POLYGON_PRACTICES,
  SITE_POLYGON_SOURCES,
  SITE_POLYGON_TARGET_SYSTEMS
} from "@terramatch-microservices/database/constants";
import { CursorPage, NumberPage, Page } from "@terramatch-microservices/common/dto/page.dto";
import { Type, TypeHelpOptions } from "class-transformer";
import { LandscapeGeometry } from "@terramatch-microservices/database/entities";
import { LandscapeSlug } from "@terramatch-microservices/database/types/landscapeGeometry";
import { TransformBooleanString } from "@terramatch-microservices/common/decorators/transform-boolean-string.decorator";

export const SITE_POLYGON_SEARCH_FIELDS = ["siteName", "polyName", "polygonUuid"] as const;
export type SitePolygonSearchField = (typeof SITE_POLYGON_SEARCH_FIELDS)[number];

class QuerySort {
  @ApiProperty({ name: "sort[field]", required: false })
  @IsOptional()
  field?: string;

  @ApiProperty({ name: "sort[direction]", required: false, enum: ["ASC", "DESC"], default: "ASC" })
  @IsEnum(["ASC", "DESC"])
  @IsOptional()
  direction?: "ASC" | "DESC";
}

const SITE_POLYGON_PRACTICE_FILTER_VALUES = [...SITE_POLYGON_PRACTICES];
const SITE_POLYGON_TARGET_SYS_FILTER_VALUES = [...SITE_POLYGON_TARGET_SYSTEMS];
const SITE_POLYGON_DISTR_FILTER_VALUES = [...SITE_POLYGON_DISTRIBUTIONS];
const SITE_POLYGON_SOURCE_FILTER_VALUES = [...SITE_POLYGON_SOURCES];

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
    name: "validationStatus[]",
    isArray: true,
    required: false,
    description: "Filter results by validation status"
  })
  @IsOptional()
  @IsArray()
  validationStatus?: string[];

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
    name: "projectShortNames[]",
    isArray: true,
    required: false,
    description: "Filter results by project short name(s)"
  })
  @IsOptional()
  @IsArray()
  projectShortNames?: string[];

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
    name: "polygonUuid[]",
    isArray: true,
    required: false,
    description: "Filter results by polygon UUID(s)"
  })
  @IsOptional()
  @IsArray()
  polygonUuid?: string[];

  @ApiProperty({
    name: "projectCohort[]",
    isArray: true,
    required: false,
    description: "Filter results by project cohorts. May not be used with projectId[] or siteId[]"
  })
  @IsOptional()
  @IsArray()
  projectCohort?: string[];

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
    type: String,
    format: "date",
    description: "Inclusive lower bound for plant start date (plantStart)"
  })
  @IsOptional()
  @IsDate()
  plantStartFrom?: Date;

  @ApiProperty({
    required: false,
    type: String,
    format: "date",
    description: "Inclusive upper bound for plant start date (plantStart)"
  })
  @IsOptional()
  @IsDate()
  plantStartTo?: Date;

  @ApiProperty({
    name: "practice[]",
    isArray: true,
    required: false,
    enum: SITE_POLYGON_PRACTICES,
    description: "Filter by restoration practice (any selected value matches)"
  })
  @IsOptional()
  @IsArray()
  @IsIn(SITE_POLYGON_PRACTICE_FILTER_VALUES, { each: true })
  practice?: string[];

  @ApiProperty({
    name: "targetSys[]",
    isArray: true,
    required: false,
    enum: SITE_POLYGON_TARGET_SYSTEMS,
    description: "Filter by target land use / target system (any selected value matches)"
  })
  @IsOptional()
  @IsArray()
  @IsIn(SITE_POLYGON_TARGET_SYS_FILTER_VALUES, { each: true })
  targetSys?: string[];

  @ApiProperty({
    name: "distr[]",
    isArray: true,
    required: false,
    enum: SITE_POLYGON_DISTRIBUTIONS,
    description: "Filter by tree distribution (any selected value matches)"
  })
  @IsOptional()
  @IsArray()
  @IsIn(SITE_POLYGON_DISTR_FILTER_VALUES, { each: true })
  distr?: string[];

  @ApiProperty({
    name: "source[]",
    isArray: true,
    required: false,
    enum: SITE_POLYGON_SOURCES,
    description: "Filter by polygon source (any selected value matches)"
  })
  @IsOptional()
  @IsArray()
  @IsIn(SITE_POLYGON_SOURCE_FILTER_VALUES, { each: true })
  source?: string[];

  @ApiProperty({
    required: false,
    default: false,
    description: "Include polygons for test projects in the results."
  })
  @TransformBooleanString()
  includeTestProjects?: boolean;

  @ApiProperty({
    required: false,
    default: false,
    type: "boolean",
    description: "Filter to polygons with a failed overlap validation."
  })
  @IsOptional()
  @IsBoolean()
  @TransformBooleanString()
  hasOverlap?: boolean;

  @ValidateNested()
  @Type(({ object } = {} as TypeHelpOptions) => {
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
    name: "searchFields[]",
    isArray: true,
    required: false,
    enum: SITE_POLYGON_SEARCH_FIELDS,
    description: "Select the fields used by search."
  })
  @IsOptional()
  @IsArray()
  @IsEnum(SITE_POLYGON_SEARCH_FIELDS, { each: true })
  searchFields?: SitePolygonSearchField[];

  @ApiProperty({
    required: false,
    default: false,
    type: "boolean",
    description: "Whether to include the complete sitePolygon Dto or not"
  })
  @TransformBooleanString()
  lightResource?: boolean;

  @ApiProperty({
    required: false,
    default: false,
    type: "boolean",
    description:
      "Return only the minimal set of fields needed to plot a site polygon as a point on a map " +
      "(uuid, polygonUuid, lat, long, status). Skips computing indicators and other display data that's " +
      "expensive to build (indicators alone cost up to 6 extra DB queries per page) but unused by a map " +
      "layer. Mutually exclusive with lightResource, and requires number pagination."
  })
  @TransformBooleanString()
  mapResource?: boolean;

  @ApiProperty({
    required: false,
    default: false,
    type: "boolean",
    description:
      "Skip computing the pagination total (omits meta.total from the response). Intended for clients that " +
      "page through an entire result set and already know the total from an earlier page, so they can avoid " +
      "the cost of a redundant COUNT query (with the same joins/filters as the main query) on every page."
  })
  @TransformBooleanString()
  skipTotal?: boolean;

  @ValidateNested()
  @IsOptional()
  sort?: QuerySort;
}

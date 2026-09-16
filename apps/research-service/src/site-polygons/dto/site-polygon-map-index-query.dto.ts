import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsDate, IsEnum, IsIn, IsOptional } from "class-validator";
import {
  INDICATOR_SLUGS,
  IndicatorSlug,
  POLYGON_STATUSES,
  PolygonStatus,
  SITE_POLYGON_DISTRIBUTIONS,
  SITE_POLYGON_PRACTICES,
  SITE_POLYGON_SOURCES,
  SITE_POLYGON_SUBMISSION_CYCLES,
  SITE_POLYGON_TARGET_SYSTEMS
} from "@terramatch-microservices/database/constants";
import { TransformBooleanString } from "@terramatch-microservices/common/decorators/transform-boolean-string.decorator";
import { SITE_POLYGON_SEARCH_FIELDS, SitePolygonSearchField } from "./site-polygon-query.dto";

const SITE_POLYGON_PRACTICE_FILTER_VALUES = [...SITE_POLYGON_PRACTICES];
const SITE_POLYGON_TARGET_SYS_FILTER_VALUES = [...SITE_POLYGON_TARGET_SYSTEMS];
const SITE_POLYGON_DISTR_FILTER_VALUES = [...SITE_POLYGON_DISTRIBUTIONS];
const SITE_POLYGON_SOURCE_FILTER_VALUES = [...SITE_POLYGON_SOURCES];
const SITE_POLYGON_SUBMISSION_CYCLE_FILTER_VALUES = [...SITE_POLYGON_SUBMISSION_CYCLES];

export class SitePolygonMapIndexQueryDto {
  @ApiProperty({
    name: "siteId[]",
    isArray: true,
    required: false,
    description: "Scope results to site UUID(s). Exactly one of siteId[] or projectId[] is required."
  })
  @IsOptional()
  @IsArray()
  siteId?: string[];

  @ApiProperty({
    name: "projectId[]",
    isArray: true,
    required: false,
    description: "Scope results to project UUID(s). Exactly one of siteId[] or projectId[] is required."
  })
  @IsOptional()
  @IsArray()
  projectId?: string[];

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
    name: "polygonUuid[]",
    isArray: true,
    required: false,
    description: "Filter results by polygon UUID(s)"
  })
  @IsOptional()
  @IsArray()
  polygonUuid?: string[];

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
    name: "submissionCycle[]",
    isArray: true,
    required: false,
    enum: SITE_POLYGON_SUBMISSION_CYCLES,
    description: "Filter by submission cycle (any selected value matches)"
  })
  @IsOptional()
  @IsArray()
  @IsIn(SITE_POLYGON_SUBMISSION_CYCLE_FILTER_VALUES, { each: true })
  submissionCycle?: string[];

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
    type: "boolean",
    description: "Filter to polygons with a failed overlap validation."
  })
  @IsOptional()
  @IsBoolean()
  @TransformBooleanString()
  hasOverlap?: boolean;

  @ApiProperty({
    required: false,
    default: false,
    type: "boolean",
    description: "Soft-deleted polygons for one site. Requires exactly one siteId[] value."
  })
  @IsOptional()
  @IsBoolean()
  @TransformBooleanString()
  deletedOnly?: boolean;

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
}

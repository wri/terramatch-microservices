import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsIn,
  IsOptional,
  IsUUID,
  ValidateNested
} from "class-validator";
import {
  POLYGON_STATUSES,
  PolygonStatus,
  SITE_POLYGON_DISTRIBUTIONS,
  SITE_POLYGON_PRACTICES,
  SITE_POLYGON_SOURCES,
  SITE_POLYGON_SUBMISSION_CYCLES,
  SITE_POLYGON_TARGET_SYSTEMS
} from "@terramatch-microservices/database/constants";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { TransformBooleanString } from "@terramatch-microservices/common/decorators/transform-boolean-string.decorator";
import { SITE_POLYGON_SEARCH_FIELDS, SitePolygonSearchField } from "../../site-polygons/dto/site-polygon-search-fields";
import { SITE_POLYGON_SORT_FIELDS, SitePolygonSortField } from "../../site-polygons/site-polygon-sort";

export const SITE_POLYGON_EXPORT_FORMATS = ["geojson", "csv"] as const;
export type SitePolygonExportFormat = (typeof SITE_POLYGON_EXPORT_FORMATS)[number];

const PRACTICE_VALUES = [...SITE_POLYGON_PRACTICES];
const TARGET_SYS_VALUES = [...SITE_POLYGON_TARGET_SYSTEMS];
const DISTR_VALUES = [...SITE_POLYGON_DISTRIBUTIONS];
const SOURCE_VALUES = [...SITE_POLYGON_SOURCES];
const SUBMISSION_CYCLE_VALUES = [...SITE_POLYGON_SUBMISSION_CYCLES];

// The table sort, as the index endpoints take it. Exports without a sort are ordered by id.
export class GeoJsonExportSort {
  @ApiProperty({
    required: false,
    enum: SITE_POLYGON_SORT_FIELDS,
    description: "Field to sort by. practice/distr use joined-code sort keys."
  })
  @IsOptional()
  @IsIn([...SITE_POLYGON_SORT_FIELDS])
  field?: SitePolygonSortField;

  @ApiProperty({ required: false, enum: ["ASC", "DESC"], default: "ASC" })
  @IsOptional()
  @IsEnum(["ASC", "DESC"])
  direction?: "ASC" | "DESC";
}

// The table filters, validated the same way as the index endpoints so an export matches what the table shows.
export class GeoJsonExportAttributes {
  @ApiProperty({
    required: false,
    type: GeoJsonExportSort,
    description: "Sort the rows the way the table is sorted."
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoJsonExportSort)
  sort?: GeoJsonExportSort;

  @ApiProperty({
    enum: SITE_POLYGON_EXPORT_FORMATS,
    required: false,
    default: "geojson",
    description: "File format of the export. Defaults to GeoJSON."
  })
  @IsOptional()
  @IsIn(SITE_POLYGON_EXPORT_FORMATS)
  format?: SitePolygonExportFormat;

  @ApiProperty({
    isArray: true,
    type: String,
    required: false,
    description: "Export all active polygons in these projects."
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  projectUuids?: string[];

  @ApiProperty({
    isArray: true,
    type: String,
    required: false,
    description: "Export all active polygons in these sites."
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  siteUuids?: string[];

  @ApiProperty({
    isArray: true,
    type: String,
    required: false,
    description: "Export these active polygons (polygon geometry UUIDs, as used by geojson?uuid=)."
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  polygonUuids?: string[];

  @ApiProperty({
    enum: POLYGON_STATUSES,
    isArray: true,
    required: false,
    description: "Filter results by polygon status"
  })
  @IsOptional()
  @IsArray()
  polygonStatus?: PolygonStatus[];

  @ApiProperty({
    isArray: true,
    type: String,
    required: false,
    description: "Filter results by validation status"
  })
  @IsOptional()
  @IsArray()
  validationStatus?: string[];

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
    isArray: true,
    required: false,
    enum: SITE_POLYGON_PRACTICES,
    description: "Filter by restoration practice (any selected value matches)"
  })
  @IsOptional()
  @IsArray()
  @IsIn(PRACTICE_VALUES, { each: true })
  practice?: string[];

  @ApiProperty({
    isArray: true,
    required: false,
    enum: SITE_POLYGON_TARGET_SYSTEMS,
    description: "Filter by target land use / target system (any selected value matches)"
  })
  @IsOptional()
  @IsArray()
  @IsIn(TARGET_SYS_VALUES, { each: true })
  targetSys?: string[];

  @ApiProperty({
    isArray: true,
    required: false,
    enum: SITE_POLYGON_SUBMISSION_CYCLES,
    description: "Filter by submission cycle (any selected value matches)"
  })
  @IsOptional()
  @IsArray()
  @IsIn(SUBMISSION_CYCLE_VALUES, { each: true })
  submissionCycle?: string[];

  @ApiProperty({
    isArray: true,
    required: false,
    enum: SITE_POLYGON_DISTRIBUTIONS,
    description: "Filter by tree distribution (any selected value matches)"
  })
  @IsOptional()
  @IsArray()
  @IsIn(DISTR_VALUES, { each: true })
  distr?: string[];

  @ApiProperty({
    isArray: true,
    required: false,
    enum: SITE_POLYGON_SOURCES,
    description: "Filter by polygon source (any selected value matches)"
  })
  @IsOptional()
  @IsArray()
  @IsIn(SOURCE_VALUES, { each: true })
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
    description: "Filter to polygons linked to a disturbance (disturbance_id IS NOT NULL)."
  })
  @IsOptional()
  @IsBoolean()
  @TransformBooleanString()
  hasDisturbance?: boolean;

  @ApiProperty({
    required: false,
    default: false,
    type: "boolean",
    description: "Soft-deleted polygons for the scope. Only applies to site or project scopes."
  })
  @IsOptional()
  @IsBoolean()
  @TransformBooleanString()
  deletedOnly?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  search?: string;

  @ApiProperty({
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

export class GeoJsonExportBodyDto extends JsonApiBodyDto(
  class GeoJsonExportData extends CreateDataDto("geojsonExports", GeoJsonExportAttributes) {}
) {}

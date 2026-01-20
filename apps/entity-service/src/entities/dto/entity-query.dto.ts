import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsIn, IsInt, IsOptional, Max, Min, ValidateNested } from "class-validator";
import {
  POLYGON_STATUSES_FILTERS,
  PolygonStatusFilter,
  PROCESSABLE_ASSOCIATIONS,
  PROCESSABLE_ENTITIES
} from "../entities.service";
import { Type } from "class-transformer";
import { IndexQueryDto } from "@terramatch-microservices/common/dto/index-query.dto";
import { MAX_PAGE_SIZE } from "@terramatch-microservices/common/util/paginated-query.builder";
import { TransformBooleanString } from "@terramatch-microservices/common/decorators/transform-boolean-string.decorator";
import { PlantingStatus } from "@terramatch-microservices/database/constants/status";

export const VALID_SIDELOAD_TYPES = [...PROCESSABLE_ENTITIES, ...PROCESSABLE_ASSOCIATIONS] as const;

export type SideloadType = (typeof VALID_SIDELOAD_TYPES)[number];

export class EntitySideload {
  @IsIn(VALID_SIDELOAD_TYPES)
  @ApiProperty({
    name: "entity",
    enum: VALID_SIDELOAD_TYPES,
    description: "Entity or association type to sideload"
  })
  entity: SideloadType;

  @ApiProperty({ name: "pageSize", description: "The page size to include." })
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number;
}

export class EntityQueryDto extends IndexQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  search?: string;

  @ApiProperty({
    required: false,
    description: "Search query used for filtering selectable options in autocomplete fields."
  })
  @IsOptional()
  searchFilter?: string;

  @ApiProperty({ required: false, isArray: true })
  @IsOptional()
  @IsArray()
  frameworkKey?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  organisationUuid?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  country?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  status?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  updateRequestStatus?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  projectUuid?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  nurseryUuid?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  siteUuid?: string;

  @ApiProperty({ required: false, isArray: true, description: "Filter by landscape 3-letter codes: gcb, grv, ikr" })
  @IsOptional()
  @IsArray()
  landscape?: string[];

  @ApiProperty({ required: false, isArray: true, description: "Filter by organisation types" })
  @IsOptional()
  @IsArray()
  organisationType?: string[];

  @ApiProperty({ required: false, isArray: true, description: "Filter by cohorts" })
  @IsOptional()
  @IsArray()
  cohort?: string[];

  @ApiProperty({
    required: false,
    description: "If the base entity supports it, this will load the first page of associated entities",
    type: [EntitySideload]
  })
  @IsArray()
  @IsOptional()
  @Type(() => EntitySideload)
  @ValidateNested({ each: true })
  sideloads?: EntitySideload[];

  @ApiProperty({ required: false, enum: POLYGON_STATUSES_FILTERS })
  @IsOptional()
  @IsIn(POLYGON_STATUSES_FILTERS)
  polygonStatus?: PolygonStatusFilter;

  @ApiProperty({ required: false })
  @TransformBooleanString({ optional: true })
  nothingToReport?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  shortName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  plantingStatus?: PlantingStatus;

  @ApiProperty({
    required: false,
    description: "Filter reports by task UUID (used to get site/nursery reports for a specific reporting period)"
  })
  @IsOptional()
  taskUuid?: string;

  // This one is internal use only, not exposed to the API surface
  taskId?: number;
}

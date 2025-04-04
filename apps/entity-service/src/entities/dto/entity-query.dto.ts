import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { IsArray, IsEnum, IsIn, IsInt, IsOptional, Max, Min, ValidateNested } from "class-validator";
import { NumberPage } from "@terramatch-microservices/common/dto/page.dto";
import { MAX_PAGE_SIZE, PROCESSABLE_ENTITIES, ProcessableEntity, POLYGON_STATUSES_FILTERS } from "../entities.service";
import { Type } from "class-transformer";

class QuerySort {
  @ApiProperty({ name: "sort[field]", required: false })
  @IsOptional()
  field?: string;

  @ApiProperty({ name: "sort[direction]", required: false, enum: ["ASC", "DESC"], default: "ASC" })
  @IsEnum(["ASC", "DESC"])
  @IsOptional()
  direction?: "ASC" | "DESC";
}

export class EntitySideload {
  @IsIn(PROCESSABLE_ENTITIES)
  @ApiProperty({ name: "entity", enum: PROCESSABLE_ENTITIES, description: "Entity type to sideload" })
  entity: ProcessableEntity;

  @ApiProperty({ name: "pageSize", description: "The page size to include." })
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number;
}

export class EntityQueryDto extends IntersectionType(QuerySort, NumberPage) {
  @ValidateNested()
  @IsOptional()
  page?: NumberPage;

  @ValidateNested()
  @IsOptional()
  sort?: QuerySort;

  @ApiProperty({ required: false })
  @IsOptional()
  search?: string;

  @ApiProperty({
    required: false,
    description: "Search query used for filtering selectable options in autocomplete fields."
  })
  @IsOptional()
  searchFilter?: string;

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
  polygonStatus?: string;
}

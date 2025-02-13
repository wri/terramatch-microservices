import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsDate, IsOptional, ValidateNested } from "class-validator";
import {
  INDICATOR_SLUGS,
  IndicatorSlug,
  POLYGON_STATUSES,
  PolygonStatus
} from "@terramatch-microservices/database/constants";
import { Page } from "@terramatch-microservices/common/dto/page.dto";

export class SitePolygonQueryDto {
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
    description: "Filter results by project UUID(s). If specified, the includeTestProjects param is ignored"
  })
  @IsOptional()
  @IsArray()
  projectId?: string[];

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
    required: false,
    description: "Filter results by polygons that have been modified since the date provided"
  })
  @IsOptional()
  @IsDate()
  lastModifiedDate?: Date;

  @ApiProperty({
    required: false,
    description: "Filter results by polygons that intersect with the boundary of the polygon referenced by this UUID"
  })
  @IsOptional()
  boundaryPolygon?: string;

  @ApiProperty({
    required: false,
    default: false,
    description:
      "Include polygons for test projects in the results. If an explicit list of project UUIDs is included in projectId[], this parameter is ignored."
  })
  includeTestProjects?: boolean;

  @ApiProperty({ name: "page", required: false, description: "Pagination information" })
  @ValidateNested()
  @IsOptional()
  page?: Page;
}

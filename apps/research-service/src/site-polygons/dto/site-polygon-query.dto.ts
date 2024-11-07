import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsDate, IsInt, IsOptional, ValidateNested } from "class-validator";
import {
  INDICATOR_SLUGS,
  IndicatorSlug,
  POLYGON_STATUSES,
  PolygonStatus
} from "@terramatch-microservices/database/constants";

class Page {
  @ApiProperty({
    name: "page[size]",
    description: "The size of page being requested",
    minimum: 1,
    maximum: 100,
    default: 100
  })
  @IsOptional()
  @IsInt()
  size?: number;

  @ApiProperty({
    name: "page[after]",
    description:
      "The last record before the page being requested. The value is a polygon UUID. If not provided, the first page is returned."
  })
  @IsOptional()
  after?: string;
}

export class SitePolygonQueryDto {
  @ApiProperty({
    enum: POLYGON_STATUSES,
    name: "polygonStatus[]",
    isArray: true,
    description: "Filter results by polygon status"
  })
  @IsOptional()
  @IsArray()
  polygonStatus?: PolygonStatus[];

  @ApiProperty({
    name: "projectId[]",
    isArray: true,
    description: "Filter results by project UUID(s)"
  })
  @IsOptional()
  @IsArray()
  projectId?: string[];

  @ApiProperty({
    enum: INDICATOR_SLUGS,
    name: "missingIndicator[]",
    isArray: true,
    description: "Filter results by polygons that are missing at least one of the indicators listed"
  })
  @IsOptional()
  @IsArray()
  missingIndicator?: IndicatorSlug[];

  @ApiProperty({ description: "Filter results by polygons that have been modified since the date provided" })
  @IsOptional()
  @IsDate()
  lastModifiedDate?: Date;

  @ApiProperty({
    description: "Filter results by polygons that are within the boundary of the polygon referenced by this UUID"
  })
  @IsOptional()
  boundaryPolygon?: string;

  @ApiProperty({ name: "page", description: "Pagination information" })
  @ValidateNested()
  @IsOptional()
  page?: Page;
}

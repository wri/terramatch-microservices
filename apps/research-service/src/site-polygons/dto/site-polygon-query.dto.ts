import { ApiProperty } from '@nestjs/swagger';
import { POLYGON_STATUSES, PolygonStatus } from './site-polygon.dto';
import { INDICATOR_SLUGS, IndicatorSlug } from './indicators.dto';

export class SitePolygonQueryDto {
  @ApiProperty({
    enum: POLYGON_STATUSES,
    name: 'polygonStatus[]',
    required: false,
    isArray: true,
    description: 'Filter results by polygon status',
  })
  polygonStatus?: PolygonStatus[];

  @ApiProperty({
    name: 'projectId[]',
    required: false,
    isArray: true,
    description: 'Filter results by project UUID(s)',
  })
  projectId?: string[];

  @ApiProperty({
    enum: INDICATOR_SLUGS,
    name: 'missingIndicator[]',
    required: false,
    isArray: true,
    description:
      'Filter results by polygons that are missing at least one of the indicators listed',
  })
  missingIndicator?: IndicatorSlug[];

  @ApiProperty({
    required: false,
    description:
      'Filter results by polygons that have been modified since the date provided',
  })
  lastModifiedDate?: Date;

  @ApiProperty({
    required: false,
    description:
      'Filter results by polygons that are within the boundary of the polygon referenced by this UUID',
  })
  boundaryPolygon?: string;

  @ApiProperty({
    required: false,
    name: 'page[size]',
    description: 'The size of page being requested',
    minimum: 1,
    maximum: 100,
    default: 100,
  })
  pageSize?: number;

  @ApiProperty({
    required: false,
    name: 'page[after]',
    description:
      'The last record before the page being requested. The value is a polygon UUID. If not provided, the first page is returned.',
  })
  pageAfterCursor?: string;
}

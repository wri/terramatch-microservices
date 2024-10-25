import { ApiProperty } from '@nestjs/swagger';
import {
  INDICATOR_TYPES,
  IndicatorType,
  POLYGON_STATUSES,
  PolygonStatus
} from './site-polygon.dto';

export class SitePolygonQueryDto {
  @ApiProperty({
    enum: POLYGON_STATUSES,
    name: 'polygonStatus[]',
    required: false,
    isArray: true,
    description: 'Filter results by polygon status'
  })
  polygonStatus?: PolygonStatus[]

  @ApiProperty({
    name: 'projectId[]',
    required: false,
    isArray: true,
    description: 'Filter results by project UUID(s)'
  })
  projectId?: string[]

  @ApiProperty({
    enum: INDICATOR_TYPES,
    name: 'missingIndicator[]',
    required: false,
    isArray: true,
    description: 'Filter results by polygons that are missing at least one of the indicators listed'
  })
  missingIndicator?: IndicatorType[]

  @ApiProperty({
    required: false,
    description: 'Filter results by polygons that have been modified since the date provided'
  })
  lastModifiedDate?: Date

  @ApiProperty({
    required: false,
    description: 'Filter results by polygons that are within the boundary of the polygon referenced by this UUID'
  })
  boundaryPolygon?: string
}

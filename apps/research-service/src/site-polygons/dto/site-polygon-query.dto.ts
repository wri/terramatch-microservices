import { ApiProperty } from '@nestjs/swagger';
import { POLYGON_STATUSES, PolygonStatus } from './site-polygon.dto';

export class SitePolygonQueryDto {
  @ApiProperty({
    enum: POLYGON_STATUSES,
    name: 'polygonStatus[]',
    required: false,
    isArray: true,
    description: 'Filter results by polygon status'
  })
  polygonStatus?: PolygonStatus[]
}

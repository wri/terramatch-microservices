import { ApiProperty } from '@nestjs/swagger';
import {
  IndicatorFieldMonitoringDto,
  IndicatorHectaresDto, IndicatorMsuCarbonDto,
  IndicatorTreeCountDto, IndicatorTreeCoverDto,
  IndicatorTreeCoverLossDto
} from './indicators.dto';

class SitePolygonUpdateAttributes {
  @ApiProperty({
    type: 'array',
    items: {
      oneOf: [
        { $ref: '#/components/schemas/IndicatorTreeCoverLossDto' },
        { $ref: '#/components/schemas/IndicatorHectaresDto' },
        { $ref: '#/components/schemas/IndicatorTreeCountDto' },
        { $ref: '#/components/schemas/IndicatorTreeCoverDto' },
        { $ref: '#/components/schemas/IndicatorFieldMonitoringDto' },
        { $ref: '#/components/schemas/IndicatorMsuCarbonDto' },
      ]
    },
    description: 'All indicators to update for this polygon'
  })
  indicators: (
    IndicatorTreeCoverLossDto |
    IndicatorHectaresDto |
    IndicatorTreeCountDto |
    IndicatorTreeCoverDto |
    IndicatorFieldMonitoringDto |
    IndicatorMsuCarbonDto
  )[];
}

class SitePolygonUpdate {
  @ApiProperty({ enum: ['sitePolygons'] })
  type: 'sitePolygons';

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: () => SitePolygonUpdateAttributes })
  attributes: SitePolygonUpdateAttributes;
}

export class SitePolygonBulkUpdateBodyDto {
  @ApiProperty({ isArray: true, type: () => SitePolygonUpdate })
  data: SitePolygonUpdate[];
}

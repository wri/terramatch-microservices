import { JsonApiAttributes } from '@terramatch-microservices/common/dto/json-api-attributes';
import { JsonApiDto } from '@terramatch-microservices/common/decorators';
import { ApiProperty } from '@nestjs/swagger';
import {
  IndicatorFieldMonitoringDto,
  IndicatorHectaresDto, IndicatorMsuCarbonDto,
  IndicatorTreeCountDto, IndicatorTreeCoverDto,
  IndicatorTreeCoverLossDto
} from './indicators.dto';

class TreeSpecies {
  @ApiProperty({ example: 'Acacia binervia' })
  name: string;

  @ApiProperty({ example: 15000 })
  amount: number;
}

class ReportingPeriod {
  @ApiProperty()
  dueAt: Date;

  @ApiProperty()
  submittedAt: Date;

  @ApiProperty({
    type: () => TreeSpecies,
    isArray: true,
    description: 'The tree species reported as planted during this reporting period'
  })
  treeSpecies: TreeSpecies[];
}

export const POLYGON_STATUSES = [
  'draft',
  'submitted',
  'needs-more-information',
  'approved'
];
export type PolygonStatus = (typeof POLYGON_STATUSES)[number];

@JsonApiDto({ type: 'sitePolygons' })
export class SitePolygonDto extends JsonApiAttributes<SitePolygonDto> {
  @ApiProperty()
  name: string;

  @ApiProperty({ enum: POLYGON_STATUSES })
  status: PolygonStatus;

  @ApiProperty()
  siteId: string;

  @ApiProperty()
  plantStart: Date;

  @ApiProperty()
  plantEnd: Date;

  @ApiProperty()
  practice: string;

  @ApiProperty()
  targetSys: string;

  @ApiProperty()
  distr: string;

  @ApiProperty()
  numTrees: number;

  @ApiProperty()
  calcArea: number;

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
    description: 'All indicators currently recorded for this site polygon'
  })
  indicators: (
    IndicatorTreeCoverLossDto |
    IndicatorHectaresDto |
    IndicatorTreeCountDto |
    IndicatorTreeCoverDto |
    IndicatorFieldMonitoringDto |
    IndicatorMsuCarbonDto
  )[];

  @ApiProperty({
    type: () => TreeSpecies,
    isArray: true,
    description: 'The tree species associated with the establishment of the site that this polygon relates to.'
  })
  establishmentTreeSpecies: TreeSpecies[];

  @ApiProperty({
    type: () => ReportingPeriod,
    isArray: true,
    description: 'Access to reported trees planted for each approved report on this site.'
  })
  reportingPeriods: ReportingPeriod[];
}

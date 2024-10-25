import { JsonApiAttributes } from '@terramatch-microservices/common/dto/json-api-attributes';
import { JsonApiDto } from '@terramatch-microservices/common/decorators';
import { ApiProperty } from '@nestjs/swagger';

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

/**
 * Note: this is required to be in the same order as on the source of truth in
 * confluence: https://gfw.atlassian.net/wiki/spaces/TerraMatch/pages/1018396676/D.+Code+Criteria+and+Indicator+Tables#code_indicator
 */
export const INDICATOR_TYPES = [
  'treeCover',
  'treeCoverLoss',
  'treeCoverLossFires',
  'restorationEcoregion',
  'restorationIntervention',
  'treeCount',
];
export type IndicatorType = (typeof INDICATOR_TYPES)[number];
class Indicator {
  @ApiProperty({ enum: INDICATOR_TYPES })
  type: IndicatorType;

  @ApiProperty()
  value: number;
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
    type: () => Indicator,
    isArray: true,
    description: 'All indicators currently recorded for this site polygon'
  })
  indicators: Indicator[];

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

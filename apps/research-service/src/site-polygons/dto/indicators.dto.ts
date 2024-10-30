import { ApiProperty } from '@nestjs/swagger';

// Matches the indicators defined on https://gfw.atlassian.net/wiki/spaces/TerraMatch/pages/1469448210/Indicator+Data+Model
export const INDICATORS = {
  1: 'treeCover',
  2: 'treeCoverLoss',
  3: 'treeCoverLossFires',
  4: 'restorationByEcoRegion',
  5: 'restorationByStrategy',
  6: 'restorationByLandUse',
  7: 'treeCount',
  8: 'earlyTreeVerification',
  9: 'fieldMonitoring',
  10: 'msuCarbon'
} as const;
export const INDICATOR_SLUGS = Object.values(INDICATORS);
export type IndicatorSlug = (typeof INDICATOR_SLUGS)[number];

export class IndicatorTreeCoverLossDto {
  @ApiProperty({ enum: [INDICATORS[2], INDICATORS[3]] })
  indicatorSlug: typeof INDICATORS[2] | typeof INDICATORS[3]

  @ApiProperty({ example: '2024' })
  yearOfAnalysis: number;

  @ApiProperty({
    type: 'object',
    description: 'Mapping of year of analysis to value.',
    example: { 2024: '0.6', 2023: '0.5' }
  })
  value: Record<string, number>;
}

export class IndicatorHectaresDto {
  @ApiProperty({ enum: [INDICATORS[4], INDICATORS[5], INDICATORS[6]] })
  indicatorSlug: typeof INDICATORS[4] | typeof INDICATORS[5] | typeof INDICATORS[6];

  @ApiProperty({ example: '2024' })
  yearOfAnalysis: number;

  @ApiProperty({
    type: 'object',
    description: 'Mapping of area type (eco region, land use, etc) to hectares',
    example: { 'Northern Acacia-Commiphora bushlands and thickets': 0.104 }
  })
  value: Record<string, number>;
}

export class IndicatorTreeCountDto {
  @ApiProperty({ enum: [INDICATORS[7], INDICATORS[8]] })
  indicatorSlug: typeof INDICATORS[7] | typeof INDICATORS[8];

  @ApiProperty({ example: '2024' })
  yearOfAnalysis: number;

  @ApiProperty()
  surveyType: string;

  @ApiProperty()
  surveyId: number;

  @ApiProperty()
  treeCount: number;

  @ApiProperty({ example: 'types TBD' })
  uncertaintyType: string;

  @ApiProperty()
  imagerySource: string;

  @ApiProperty({ type: 'url' })
  imageryId: string;

  @ApiProperty()
  projectPhase: string;

  @ApiProperty()
  confidence: number;
}

export class IndicatorTreeCoverDto {
  @ApiProperty({ enum: [INDICATORS[1]] })
  indicatorSlug: typeof INDICATORS[1];

  @ApiProperty({ example: '2024' })
  yearOfAnalysis: number;

  @ApiProperty({ example: '2024' })
  projectPhase: string;

  @ApiProperty()
  percentCover: number;

  @ApiProperty()
  plusMinusPercent: number
}

export class IndicatorFieldMonitoringDto {
  @ApiProperty({ enum: [INDICATORS[9]] })
  indicatorSlug: typeof INDICATORS[9];

  @ApiProperty({ example: '2024' })
  yearOfAnalysis: number;

  @ApiProperty()
  treeCount: number;

  @ApiProperty()
  projectPhase: string;

  @ApiProperty()
  species: string;

  @ApiProperty()
  survivalRate: number;
}

export class IndicatorMsuCarbonDto {
  @ApiProperty({ enum: [INDICATORS[10]] })
  indicatorSlug: typeof INDICATORS[10];

  @ApiProperty({ example: '2024' })
  yearOfAnalysis: number;

  @ApiProperty()
  carbonOutput: number;

  @ApiProperty()
  projectPhase: string;

  @ApiProperty()
  confidence: number;
}

import { ApiProperty } from "@nestjs/swagger";
import { INDICATORS } from "@terramatch-microservices/database/constants";

export class IndicatorTreeCoverLossDto {
  @ApiProperty({ enum: [INDICATORS[2], INDICATORS[3]] })
  indicatorSlug: (typeof INDICATORS)[2] | (typeof INDICATORS)[3];

  @ApiProperty({ example: "2024" })
  yearOfAnalysis: number;

  @ApiProperty({
    type: "object",
    description: "Mapping of year of analysis to value.",
    example: { 2024: "0.6", 2023: "0.5" }
  })
  value: Record<string, number>;
}

export class IndicatorHectaresDto {
  @ApiProperty({ enum: [INDICATORS[4], INDICATORS[5], INDICATORS[6]] })
  indicatorSlug: (typeof INDICATORS)[4] | (typeof INDICATORS)[5] | (typeof INDICATORS)[6];

  @ApiProperty({ example: "2024" })
  yearOfAnalysis: number;

  @ApiProperty({
    type: "object",
    description: "Mapping of area type (eco region, land use, etc) to hectares",
    example: { "Northern Acacia-Commiphora bushlands and thickets": 0.104 }
  })
  value: Record<string, number>;
}

export class IndicatorTreeCountDto {
  @ApiProperty({ enum: [INDICATORS[7], INDICATORS[8]] })
  indicatorSlug: (typeof INDICATORS)[7] | (typeof INDICATORS)[8];

  @ApiProperty({ example: "2024" })
  yearOfAnalysis: number;

  @ApiProperty()
  surveyType: string | null;

  @ApiProperty()
  surveyId: number | null;

  @ApiProperty()
  treeCount: number | null;

  @ApiProperty({ example: "types TBD" })
  uncertaintyType: string | null;

  @ApiProperty()
  imagerySource: string | null;

  @ApiProperty({ type: "url" })
  imageryId: string | null;

  @ApiProperty()
  projectPhase: string | null;

  @ApiProperty()
  confidence: number | null;
}

export class IndicatorTreeCoverDto {
  @ApiProperty({ enum: [INDICATORS[1]] })
  indicatorSlug: (typeof INDICATORS)[1];

  @ApiProperty({ example: "2024" })
  yearOfAnalysis: number;

  @ApiProperty({ example: "2024" })
  projectPhase: string | null;

  @ApiProperty()
  percentCover: number | null;

  @ApiProperty()
  plusMinusPercent: number | null;
}

export class IndicatorFieldMonitoringDto {
  @ApiProperty({ enum: [INDICATORS[9]] })
  indicatorSlug: (typeof INDICATORS)[9];

  @ApiProperty({ example: "2024" })
  yearOfAnalysis: number;

  @ApiProperty()
  treeCount: number | null;

  @ApiProperty()
  projectPhase: string | null;

  @ApiProperty()
  species: string | null;

  @ApiProperty()
  survivalRate: number | null;
}

export class IndicatorMsuCarbonDto {
  @ApiProperty({ enum: [INDICATORS[10]] })
  indicatorSlug: (typeof INDICATORS)[10];

  @ApiProperty({ example: "2024" })
  yearOfAnalysis: number;

  @ApiProperty()
  carbonOutput: number | null;

  @ApiProperty()
  projectPhase: string | null;

  @ApiProperty()
  confidence: number | null;
}

export const INDICATOR_DTOS = {
  [INDICATORS[1]]: IndicatorTreeCoverDto.prototype,
  [INDICATORS[2]]: IndicatorTreeCoverLossDto.prototype,
  [INDICATORS[3]]: IndicatorTreeCoverLossDto.prototype,
  [INDICATORS[4]]: IndicatorHectaresDto.prototype,
  [INDICATORS[5]]: IndicatorHectaresDto.prototype,
  [INDICATORS[6]]: IndicatorHectaresDto.prototype,
  [INDICATORS[7]]: IndicatorTreeCountDto.prototype,
  [INDICATORS[8]]: IndicatorTreeCountDto.prototype,
  [INDICATORS[9]]: IndicatorFieldMonitoringDto.prototype,
  [INDICATORS[10]]: IndicatorMsuCarbonDto.prototype
};

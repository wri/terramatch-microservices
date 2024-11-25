import { ApiProperty } from "@nestjs/swagger";
import { INDICATORS } from "@terramatch-microservices/database/constants";
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class IndicatorTreeCoverLossDto {
  @ApiProperty({ enum: [INDICATORS[2], INDICATORS[3]] })
  indicatorSlug: (typeof INDICATORS)[2] | (typeof INDICATORS)[3];

  @IsInt()
  @ApiProperty({ example: 2024 })
  yearOfAnalysis: number;

  @IsNotEmpty()
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

  @IsInt()
  @ApiProperty({ example: "2024" })
  yearOfAnalysis: number;

  @IsNotEmpty()
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

  @IsInt()
  @ApiProperty({ example: "2024" })
  yearOfAnalysis: number;

  @IsString()
  @IsOptional()
  @ApiProperty()
  surveyType: string | null;

  @IsNumber()
  @IsOptional()
  @ApiProperty()
  surveyId: number | null;

  @IsNumber()
  @IsOptional()
  @ApiProperty()
  treeCount: number | null;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: "types TBD" })
  uncertaintyType: string | null;

  @IsString()
  @IsOptional()
  @ApiProperty()
  imagerySource: string | null;

  @IsString()
  @IsOptional()
  @ApiProperty({ type: "url" })
  imageryId: string | null;

  @IsString()
  @IsOptional()
  @ApiProperty()
  projectPhase: string | null;

  @IsNumber()
  @IsOptional()
  @ApiProperty()
  confidence: number | null;
}

export class IndicatorTreeCoverDto {
  @ApiProperty({ enum: [INDICATORS[1]] })
  indicatorSlug: (typeof INDICATORS)[1];

  @IsInt()
  @ApiProperty({ example: "2024" })
  yearOfAnalysis: number;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: "2024" })
  projectPhase: string | null;

  @IsNumber()
  @IsOptional()
  @ApiProperty()
  percentCover: number | null;

  @IsNumber()
  @IsOptional()
  @ApiProperty()
  plusMinusPercent: number | null;
}

export class IndicatorFieldMonitoringDto {
  @ApiProperty({ enum: [INDICATORS[9]] })
  indicatorSlug: (typeof INDICATORS)[9];

  @IsInt()
  @ApiProperty({ example: "2024" })
  yearOfAnalysis: number;

  @IsNumber()
  @IsOptional()
  @ApiProperty()
  treeCount: number | null;

  @IsString()
  @IsOptional()
  @ApiProperty()
  projectPhase: string | null;

  @IsString()
  @IsOptional()
  @ApiProperty()
  species: string | null;

  @IsNumber()
  @IsOptional()
  @ApiProperty()
  survivalRate: number | null;
}

export class IndicatorMsuCarbonDto {
  @ApiProperty({ enum: [INDICATORS[10]] })
  indicatorSlug: (typeof INDICATORS)[10];

  @IsInt()
  @ApiProperty({ example: "2024" })
  yearOfAnalysis: number;

  @IsNumber()
  @IsOptional()
  @ApiProperty()
  carbonOutput: number | null;

  @IsString()
  @IsOptional()
  @ApiProperty()
  projectPhase: string | null;

  @IsNumber()
  @IsOptional()
  @ApiProperty()
  confidence: number | null;
}

export const INDICATOR_DTOS = {
  [INDICATORS[1]]: IndicatorTreeCoverDto,
  [INDICATORS[2]]: IndicatorTreeCoverLossDto,
  [INDICATORS[3]]: IndicatorTreeCoverLossDto,
  [INDICATORS[4]]: IndicatorHectaresDto,
  [INDICATORS[5]]: IndicatorHectaresDto,
  [INDICATORS[6]]: IndicatorHectaresDto,
  [INDICATORS[7]]: IndicatorTreeCountDto,
  [INDICATORS[8]]: IndicatorTreeCountDto,
  [INDICATORS[9]]: IndicatorFieldMonitoringDto,
  [INDICATORS[10]]: IndicatorMsuCarbonDto
};

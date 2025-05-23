import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsOptional } from "class-validator";

export class DashboardQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  country?: string;

  @ApiProperty({
    isArray: true,
    required: false,
    description: "Filter results by programmes"
  })
  @IsOptional()
  @IsArray()
  programmes?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  cohort?: string;

  @ApiProperty({
    isArray: true,
    required: false,
    description: "Filter results by landscapes"
  })
  @IsOptional()
  @IsArray()
  landscapes?: string[];

  @ApiProperty({
    isArray: true,
    required: false,
    description: "Filter results by organisationType"
  })
  @IsOptional()
  @IsArray()
  organisationType?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  projectUuid?: string;
}

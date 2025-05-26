import { ApiProperty } from "@nestjs/swagger";
import { IsOptional } from "class-validator";

export class DashboardQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  country?: string;

  @ApiProperty({
    required: false,
    description: "Filter results by programmes"
  })
  @IsOptional()
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
  landscapes?: string[];

  @ApiProperty({
    required: false,
    description: "Filter results by organisationType"
  })
  @IsOptional()
  organisationType?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  projectUuid?: string;
}

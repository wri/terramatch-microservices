import { ApiProperty } from "@nestjs/swagger";
import { IsOptional } from "class-validator";

export class DashboardQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  country?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  programmes?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  cohort?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  landscapes?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  organisationType?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  projectUuid?: string;
}

import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsIn, IsOptional } from "class-validator";
import {
  FRAMEWORK_KEYS,
  FrameworkKey,
  PLANTING_STATUSES,
  PlantingStatus
} from "@terramatch-microservices/database/constants";

export class SitePolygonProjectFiltersDto {
  @ApiProperty({
    enum: FRAMEWORK_KEYS,
    name: "frameworkKey[]",
    isArray: true,
    required: false,
    description: "Filter results by project framework key(s)"
  })
  @IsOptional()
  @IsArray()
  @IsIn(FRAMEWORK_KEYS, { each: true })
  frameworkKey?: FrameworkKey[];

  @ApiProperty({
    name: "country[]",
    isArray: true,
    required: false,
    description: "Filter results by project country code(s)"
  })
  @IsOptional()
  @IsArray()
  country?: string[];

  @ApiProperty({
    name: "organisationUuid[]",
    isArray: true,
    required: false,
    description: "Filter results by project organisation UUID(s)"
  })
  @IsOptional()
  @IsArray()
  organisationUuid?: string[];

  @ApiProperty({
    enum: PLANTING_STATUSES,
    required: false,
    description: "Filter results by the planting status of the project's latest approved project report"
  })
  @IsOptional()
  @IsIn(PLANTING_STATUSES)
  plantingStatus?: PlantingStatus;
}

import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsOptional } from "class-validator";
import {
  FRAMEWORK_KEYS_TF,
  LANDSCAPE_TYPES,
  LandscapeType,
  ORGANISATION_TYPES,
  OrganisationType,
  FrameworkKeyTF
} from "@terramatch-microservices/database/constants";

export class DashboardQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  country?: string;

  @ApiProperty({
    enum: FRAMEWORK_KEYS_TF,
    isArray: true,
    required: false,
    name: "programmesType[]",
    description: "Filter results by programmes"
  })
  @IsOptional()
  @IsArray()
  programmes?: FrameworkKeyTF[];

  @ApiProperty({ required: false, isArray: true, description: "Filter by cohorts" })
  @IsOptional()
  @IsArray()
  cohort?: string[];

  @ApiProperty({
    enum: LANDSCAPE_TYPES,
    isArray: true,
    required: false,
    name: "landscapes",
    description:
      "Filter results by landscapes using 3-letter codes: gcb (Ghana Cocoa Belt), grv (Greater Rift Valley of Kenya), ikr (Lake Kivu & Rusizi River Basin)"
  })
  @IsOptional()
  @IsArray()
  landscapes?: LandscapeType[];

  @ApiProperty({
    enum: ORGANISATION_TYPES,
    isArray: true,
    required: false,
    name: "organisationType[]",
    description: "Filter results by organisationType"
  })
  @IsOptional()
  @IsArray()
  organisationType?: OrganisationType[];

  @ApiProperty({ required: false })
  @IsOptional()
  projectUuid?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  polygonStatus?: string[];
}

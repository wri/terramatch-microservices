import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsIn, IsInt, IsOptional, Max, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import {
  FrameworkType,
  FRAMEWORK_TF_TYPES,
  LANDSCAPE_TYPES,
  LandscapeType,
  ORGANISATION_TYPES,
  OrganisationType
} from "@terramatch-microservices/database/constants";

export const VALID_SIDELOAD_TYPES = ["sitePolygons", "demographics"] as const;
export type SideloadType = (typeof VALID_SIDELOAD_TYPES)[number];

export class DashboardSideload {
  @IsIn(VALID_SIDELOAD_TYPES)
  @ApiProperty({
    name: "entity",
    enum: VALID_SIDELOAD_TYPES,
    description: "Entity type to sideload"
  })
  entity: SideloadType;

  @ApiProperty({ name: "pageSize", description: "The page size to include." })
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number;
}

export class DashboardQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  country?: string;

  @ApiProperty({
    enum: FRAMEWORK_TF_TYPES,
    isArray: true,
    required: false,
    name: "programmesType[]",
    description: "Filter results by programmes"
  })
  @IsOptional()
  @IsArray()
  programmes?: FrameworkType[];

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

  @ApiProperty({
    required: false,
    description: "If the base entity supports it, this will load the first page of associated entities",
    type: [DashboardSideload]
  })
  @IsArray()
  @IsOptional()
  @Type(() => DashboardSideload)
  @ValidateNested({ each: true })
  sideloads?: DashboardSideload[];
}

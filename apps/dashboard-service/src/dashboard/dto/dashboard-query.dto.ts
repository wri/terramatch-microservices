import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsOptional } from "class-validator";
import {
  FRAMEWORK_TF_TYPES,
  FrameworkType,
  LANDSCAPE_TYPES,
  LandscapeType,
  ORGANISATION_TYPES,
  OrganisationType
} from "@terramatch-microservices/database/constants";

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

  @ApiProperty({ required: false })
  @IsOptional()
  cohort?: string;

  @ApiProperty({
    enum: LANDSCAPE_TYPES,
    isArray: true,
    required: false,
    name: "landscapesType[]",
    description: "Filter results by landscapes"
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
}

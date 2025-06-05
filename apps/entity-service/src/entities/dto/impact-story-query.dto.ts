import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsEnum, IsOptional, ValidateNested } from "class-validator";
import { NumberPage } from "@terramatch-microservices/common/dto/page.dto";
import { IndexQueryDto } from "./index-query.dto";
import {
  FRAMEWORK_TF_TYPES,
  FrameworkType,
  LANDSCAPE_TYPES,
  LandscapeType,
  ORGANISATION_TYPES,
  OrganisationType
} from "@terramatch-microservices/database/constants";

class QuerySort {
  @ApiProperty({ name: "sort[field]", required: false })
  @IsOptional()
  field?: string;

  @ApiProperty({ name: "sort[direction]", required: false, enum: ["ASC", "DESC"], default: "ASC" })
  @IsEnum(["ASC", "DESC"])
  @IsOptional()
  direction?: "ASC" | "DESC";
}

class FilterItem {
  [key: string]: string | undefined | string[];
}

export class ImpactStoryQueryDto extends IndexQueryDto {
  @ValidateNested()
  @IsOptional()
  page?: NumberPage;

  @ValidateNested()
  @IsOptional()
  sort?: QuerySort;

  @ApiProperty({ required: false })
  @IsOptional()
  search?: string;

  @ApiProperty({
    required: false,
    description: "Search query used for filtering selectable options in autocomplete fields."
  })
  @IsOptional()
  filter?: FilterItem;

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
    name: "landscapes",
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

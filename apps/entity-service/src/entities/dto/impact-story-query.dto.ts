import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsEnum, IsOptional, ValidateNested } from "class-validator";
import { NumberPage } from "@terramatch-microservices/common/dto/page.dto";
import { IndexQueryDto } from "./index-query.dto";
import { ORGANISATION_TYPES, OrganisationType } from "@terramatch-microservices/database/constants";

class QuerySort {
  @ApiProperty({ name: "sort[field]", required: false })
  @IsOptional()
  field?: string;

  @ApiProperty({ name: "sort[direction]", required: false, enum: ["ASC", "DESC"], default: "ASC" })
  @IsEnum(["ASC", "DESC"])
  @IsOptional()
  direction?: "ASC" | "DESC";
}

export class ImpactStoryQueryDto extends IndexQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  country?: string;

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
  category?: string;
}

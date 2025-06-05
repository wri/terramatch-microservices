import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { IsEnum, IsOptional, ValidateNested } from "class-validator";
import { NumberPage } from "@terramatch-microservices/common/dto/page.dto";
import { IndexQueryDto } from "./index-query.dto";

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
}

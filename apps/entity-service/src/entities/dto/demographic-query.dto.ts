import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { IsArray, IsEnum, IsOptional, ValidateNested } from "class-validator";
import { NumberPage } from "@terramatch-microservices/common/dto/page.dto";

class QuerySort {
  @ApiProperty({ name: "sort[field]", required: false })
  @IsOptional()
  field?: string;

  @ApiProperty({ name: "sort[direction]", required: false, enum: ["ASC", "DESC"], default: "ASC" })
  @IsEnum(["ASC", "DESC"])
  @IsOptional()
  direction?: "ASC" | "DESC";
}

export class DemographicQueryDto extends IntersectionType(QuerySort, NumberPage) {
  @ValidateNested()
  @IsOptional()
  page?: NumberPage;

  @ValidateNested()
  @IsOptional()
  sort?: QuerySort;

  @ApiProperty({ required: false, isArray: true, description: "projectReport uuid array" })
  @IsOptional()
  @IsArray()
  projectReportUuid?: string[];
}

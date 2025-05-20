import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { IsEnum, IsOptional, ValidateNested } from "class-validator";
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

export class DashboardQueryDto extends IntersectionType(QuerySort, NumberPage) {
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

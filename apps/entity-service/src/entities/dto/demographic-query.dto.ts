import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { IsArray, IsOptional } from "class-validator";
import { NumberPage } from "@terramatch-microservices/common/dto/page.dto";
import { IndexQueryDto } from "./index-query.dto";

export class DemographicQueryDto extends IntersectionType(IndexQueryDto, NumberPage) {
  @ApiProperty({ required: false, isArray: true, description: "project uuid array" })
  @IsOptional()
  @IsArray()
  projectUuid?: string[];

  @ApiProperty({ required: false, isArray: true, description: "projectReport uuid array" })
  @IsOptional()
  @IsArray()
  projectReportUuid?: string[];

  @ApiProperty({ required: false, isArray: true, description: "siteReport uuid array" })
  @IsOptional()
  @IsArray()
  siteReportUuid?: string[];
}

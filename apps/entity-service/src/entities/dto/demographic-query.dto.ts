import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsOptional } from "class-validator";
import { IndexQueryDto } from "@terramatch-microservices/common/dto/index-query.dto";

export class DemographicQueryDto extends IndexQueryDto {
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

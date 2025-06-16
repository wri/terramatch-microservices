import { IndexQueryDto } from "./index-query.dto";
import { IsArray, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class DisturbanceQueryDto extends IndexQueryDto {
  @ApiProperty({ required: false, isArray: true, description: "siteReport uuid array" })
  @IsOptional()
  @IsArray()
  siteReportUuid?: string[];
}

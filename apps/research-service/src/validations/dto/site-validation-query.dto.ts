import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional, Min } from "class-validator";
import { IndexQueryDto } from "./index-query.dto";

export class SiteValidationQueryDto extends IndexQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @ApiProperty({
    description: "Filter validations by criteria ID",
    required: false,
    example: 3
  })
  criteriaId?: number;
}

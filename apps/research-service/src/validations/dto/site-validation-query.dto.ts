import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional, Min, ValidateNested } from "class-validator";
import { NumberPage } from "@terramatch-microservices/common/dto/page.dto";
import { Type } from "class-transformer";

export class SiteValidationQueryDto {
  @ValidateNested()
  @Type(() => NumberPage)
  @IsOptional()
  @ApiProperty({ type: NumberPage })
  page?: NumberPage;

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

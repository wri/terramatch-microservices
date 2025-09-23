import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { IsInt, IsOptional, Min, ValidateNested } from "class-validator";
import { NumberPage } from "@terramatch-microservices/common/dto/page.dto";

export class SiteValidationQueryDto extends IntersectionType(NumberPage) {
  @ValidateNested()
  @IsOptional()
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

import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { IsInt, IsOptional, ValidateNested } from "class-validator";
import { NumberPage } from "@terramatch-microservices/common/dto/page.dto";
import { CriteriaId } from "@terramatch-microservices/database/constants";

export class SiteValidationQueryDto extends IntersectionType(NumberPage) {
  @ValidateNested()
  @IsOptional()
  page?: NumberPage;

  @IsOptional()
  @IsInt()
  @ApiProperty({
    description: "Filter validations by criteria ID",
    required: false,
    example: 3
  })
  criteriaId?: CriteriaId;
}

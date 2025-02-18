import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, ValidateNested } from "class-validator";
import { NumberPage } from "@terramatch-microservices/common/dto/page.dto";

export class EntityQueryDto {
  @ApiProperty({ name: "page", required: false, description: "Pagination information" })
  @ValidateNested()
  @IsOptional()
  page?: NumberPage;
}

import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, ValidateNested } from "class-validator";
import { Page } from "@terramatch-microservices/common/dto/page.dto";

export class EntityQueryDto {
  @ApiProperty({ name: "page", required: false, description: "Pagination information" })
  @ValidateNested()
  @IsOptional()
  page?: Page;
}

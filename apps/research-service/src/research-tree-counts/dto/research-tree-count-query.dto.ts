import { IntersectionType } from "@nestjs/swagger";
import { IsOptional, ValidateNested } from "class-validator";
import { CursorPage } from "@terramatch-microservices/common/dto/page.dto";

export class ResearchTreeCountQueryDto extends IntersectionType(CursorPage) {
  @ValidateNested()
  @IsOptional()
  page?: CursorPage;
}

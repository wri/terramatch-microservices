import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { INDICATOR_SLUGS, IndicatorSlug } from "@terramatch-microservices/database/constants";

export class IndicatorsParamDto {
  @IsIn(INDICATOR_SLUGS)
  @ApiProperty({ enum: INDICATOR_SLUGS, description: "Entity type for associations" })
  slug: IndicatorSlug;
}

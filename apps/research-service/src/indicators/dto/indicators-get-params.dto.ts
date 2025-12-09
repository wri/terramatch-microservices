import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsUUID } from "class-validator";
import { INDICATOR_SLUGS, IndicatorSlug } from "@terramatch-microservices/database/constants";

export const INDICATOR_ENTITY_TYPES = ["sitePolygon"] as const;
export type IndicatorEntityType = (typeof INDICATOR_ENTITY_TYPES)[number];

export class IndicatorsGetParamsDto {
  @IsIn(INDICATOR_ENTITY_TYPES)
  @ApiProperty({ enum: INDICATOR_ENTITY_TYPES, description: "Entity type (currently only sitePolygon)" })
  entity: IndicatorEntityType;

  @IsUUID()
  @ApiProperty({ description: "Entity UUID (site polygon UUID)" })
  uuid: string;

  @IsIn(INDICATOR_SLUGS)
  @ApiProperty({ enum: INDICATOR_SLUGS, description: "Indicator slug" })
  slug: IndicatorSlug;
}

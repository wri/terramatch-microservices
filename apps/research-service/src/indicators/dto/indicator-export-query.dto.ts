import { INDICATOR_SLUGS, IndicatorSlug } from "@terramatch-microservices/database/constants";
import { IsIn, IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class IndicatorExportQueryDto {
  @IsIn(["sites", "projects"])
  @ApiProperty({ enum: ["sites", "projects"], description: "Entity type for export" })
  entityType: "sites" | "projects";

  @IsUUID()
  @ApiProperty({ description: "UUID of the entity." })
  entityUuid: string;

  @IsIn(INDICATOR_SLUGS)
  @ApiProperty({ enum: INDICATOR_SLUGS, description: "Indicator slug for export" })
  slug: IndicatorSlug;
}

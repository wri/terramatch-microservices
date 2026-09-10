import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsIn, IsOptional } from "class-validator";
import { SitePolygonMapIndexQueryDto } from "./site-polygon-map-index-query.dto";

export const SUMMARY_INDICATOR_SLUGS = [
  "treeCoverLoss",
  "treeCoverLossFires",
  "restorationByEcoRegion",
  "restorationByStrategy",
  "restorationByLandUse"
] as const;

export type SummaryIndicatorSlug = (typeof SUMMARY_INDICATOR_SLUGS)[number];

export class SitePolygonSummaryQueryDto extends SitePolygonMapIndexQueryDto {
  @ApiProperty({
    enum: SUMMARY_INDICATOR_SLUGS,
    name: "indicatorSlug[]",
    isArray: true,
    required: false,
    description:
      "Optional indicator aggregate blocks for Monitored charts and run-analysis. " +
      "Distinct from presentIndicator[] / missingIndicator[] which filter the polygon scope."
  })
  @IsOptional()
  @IsArray()
  @IsIn([...SUMMARY_INDICATOR_SLUGS], { each: true })
  indicatorSlug?: SummaryIndicatorSlug[];
}

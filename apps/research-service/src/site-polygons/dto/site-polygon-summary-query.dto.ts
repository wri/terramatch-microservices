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

export const SUMMARY_FACETS = [
  "polygonStatus",
  "practice",
  "submissionCycle",
  "targetSys",
  "validationStatus"
] as const;

export type SummaryFacet = (typeof SUMMARY_FACETS)[number];

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

  @ApiProperty({
    enum: SUMMARY_FACETS,
    name: "facet[]",
    isArray: true,
    required: false,
    description:
      "Optional per-option polygon counts for these filters, returned in facetCounts. Each facet is counted " +
      "with every other filter in the request applied, but not its own, so its options keep their counts " +
      "while that filter is active."
  })
  @IsOptional()
  @IsArray()
  @IsIn([...SUMMARY_FACETS], { each: true })
  facet?: SummaryFacet[];
}

import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";

/**
 * The shape returned by the rollup query in SitePolygonsService.getIndicatorRollup. Numeric fields
 * arrive from the driver as strings or numbers depending on the aggregate, so the DTO normalises.
 */
export type SiteIndicatorRollupRow = {
  siteUuid: string;
  siteName: string | null;
  inReviewCount: number | string;
  polygons: number | string;
  hectares: number | string | null;
  treeCoverWeightedMeanPct: number | string | null;
  treeCoverPolygonCount: number | string;
  treeCoverLossTotal: number | string | null;
  treeCoverLossPolygonCount: number | string;
};

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Per-site indicator aggregates over active, APPROVED polygons — the basis the rest of TerraMatch
 * reports on (dashboard-projects.service.ts computes totalHectaresRestoredSum the same way).
 *
 * Sites whose polygons are all unapproved still appear, with null measurements and a populated
 * inReviewCount. Omitting the row would assert the site does not exist, which is a stronger and
 * falser claim than "not measured yet".
 */
@JsonApiDto({ type: "siteIndicatorRollups" })
export class SiteIndicatorRollupDto {
  constructor(row: SiteIndicatorRollupRow) {
    this.siteUuid = row.siteUuid;
    this.siteName = row.siteName;
    this.inReviewCount = toNumber(row.inReviewCount) ?? 0;
    this.polygons = toNumber(row.polygons) ?? 0;
    this.hectares = toNumber(row.hectares);
    this.treeCoverWeightedMeanPct = toNumber(row.treeCoverWeightedMeanPct);
    this.treeCoverPolygonCount = toNumber(row.treeCoverPolygonCount) ?? 0;
    this.treeCoverLossTotal = toNumber(row.treeCoverLossTotal);
    this.treeCoverLossPolygonCount = toNumber(row.treeCoverLossPolygonCount) ?? 0;

    // The honesty fractions: what proportion of this site's approved polygons actually contributed
    // to each aggregate. A summed or averaged measurement without this is not reportable.
    this.treeCoverCoverage = this.polygons > 0 ? this.treeCoverPolygonCount / this.polygons : null;
    this.treeCoverLossCoverage = this.polygons > 0 ? this.treeCoverLossPolygonCount / this.polygons : null;
  }

  @ApiProperty({ description: "UUID of the site this row rolls up." })
  siteUuid: string;

  @ApiProperty({ nullable: true, type: String, description: "Name of the site." })
  siteName: string | null;

  @ApiProperty({
    description:
      "Active polygons on this site that are not approved (draft, pending-approval, information-required). These are excluded from every measurement below; surface the count so the omission is visible."
  })
  inReviewCount: number;

  @ApiProperty({ description: "Count of active, approved polygons on this site." })
  polygons: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: "Sum of calc_area over this site's active, approved polygons. Null when there are none."
  })
  hectares: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      "Area-weighted mean of the latest-year percent_cover across this site's approved polygons. Null when no polygon carries a value."
  })
  treeCoverWeightedMeanPct: number | null;

  @ApiProperty({ description: "Polygons that contributed to treeCoverWeightedMeanPct." })
  treeCoverPolygonCount: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      "treeCoverPolygonCount / polygons. Render alongside the mean; a partial aggregate shown as complete is worse than no number."
  })
  treeCoverCoverage: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      "Per-year tree cover loss summed across years and polygons ('treeCoverLoss' slug only; 'treeCoverLossFires' is a separate indicator). Null means not measured, not zero."
  })
  treeCoverLossTotal: number | null;

  @ApiProperty({ description: "Polygons that contributed a tree cover loss value." })
  treeCoverLossPolygonCount: number;

  @ApiProperty({ nullable: true, type: Number, description: "treeCoverLossPolygonCount / polygons." })
  treeCoverLossCoverage: number | null;
}

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

  approvedPolygons: number | string;
  approvedHectares: number | string | null;
  approvedTreeCoverWeightedMeanPct: number | string | null;
  approvedTreeCoverPolygonCount: number | string;
  approvedTreeCoverLossTotal: number | string | null;
  approvedTreeCoverLossPolygonCount: number | string;

  clientParityPolygons: number | string;
  clientParityHectares: number | string | null;
  clientParityTreeCoverWeightedMeanPct: number | string | null;
  clientParityTreeCoverPolygonCount: number | string;
  clientParityTreeCoverLossTotal: number | string | null;
  clientParityTreeCoverLossPolygonCount: number | string;
};

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

type BasisInput = {
  polygons: number | string;
  hectares: number | string | null;
  treeCoverWeightedMeanPct: number | string | null;
  treeCoverPolygonCount: number | string;
  treeCoverLossTotal: number | string | null;
  treeCoverLossPolygonCount: number | string;
};

/**
 * One aggregation basis. Both bases carry the same fields so the frontend can switch between them
 * by key rather than by branching on field names.
 */
export class SiteIndicatorBasisDto {
  constructor(input: BasisInput) {
    this.polygons = toNumber(input.polygons) ?? 0;
    this.hectares = toNumber(input.hectares);
    this.treeCoverWeightedMeanPct = toNumber(input.treeCoverWeightedMeanPct);
    this.treeCoverPolygonCount = toNumber(input.treeCoverPolygonCount) ?? 0;
    this.treeCoverLossTotal = toNumber(input.treeCoverLossTotal);
    this.treeCoverLossPolygonCount = toNumber(input.treeCoverLossPolygonCount) ?? 0;

    // The honesty fractions: what proportion of the polygons in this basis actually contributed to
    // each aggregate. A summed or averaged measurement without this is not reportable.
    this.treeCoverCoverage = this.polygons > 0 ? this.treeCoverPolygonCount / this.polygons : null;
    this.treeCoverLossCoverage = this.polygons > 0 ? this.treeCoverLossPolygonCount / this.polygons : null;
  }

  @ApiProperty({ description: "Count of polygons included in this basis." })
  polygons: number;

  @ApiProperty({ nullable: true, type: Number, description: "Sum of calc_area over this basis." })
  hectares: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: "Area-weighted mean percent tree cover. Null when no polygon carries a value."
  })
  treeCoverWeightedMeanPct: number | null;

  @ApiProperty({ description: "Polygons that contributed to treeCoverWeightedMeanPct." })
  treeCoverPolygonCount: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: "treeCoverPolygonCount / polygons. Render alongside the mean."
  })
  treeCoverCoverage: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      "Per-year tree cover loss summed across years and polygons ('treeCoverLoss' slug only). Null means not measured, not zero."
  })
  treeCoverLossTotal: number | null;

  @ApiProperty({ description: "Polygons that contributed a tree cover loss value." })
  treeCoverLossPolygonCount: number;

  @ApiProperty({ nullable: true, type: Number, description: "treeCoverLossPolygonCount / polygons." })
  treeCoverLossCoverage: number | null;
}

@JsonApiDto({ type: "siteIndicatorRollups" })
export class SiteIndicatorRollupDto {
  constructor(row: SiteIndicatorRollupRow) {
    this.siteUuid = row.siteUuid;
    this.siteName = row.siteName;
    this.inReviewCount = toNumber(row.inReviewCount) ?? 0;

    this.approved = new SiteIndicatorBasisDto({
      polygons: row.approvedPolygons,
      hectares: row.approvedHectares,
      treeCoverWeightedMeanPct: row.approvedTreeCoverWeightedMeanPct,
      treeCoverPolygonCount: row.approvedTreeCoverPolygonCount,
      treeCoverLossTotal: row.approvedTreeCoverLossTotal,
      treeCoverLossPolygonCount: row.approvedTreeCoverLossPolygonCount
    });

    this.clientParity = new SiteIndicatorBasisDto({
      polygons: row.clientParityPolygons,
      hectares: row.clientParityHectares,
      treeCoverWeightedMeanPct: row.clientParityTreeCoverWeightedMeanPct,
      treeCoverPolygonCount: row.clientParityTreeCoverPolygonCount,
      treeCoverLossTotal: row.clientParityTreeCoverLossTotal,
      treeCoverLossPolygonCount: row.clientParityTreeCoverLossPolygonCount
    });
  }

  @ApiProperty({ description: "UUID of the site this row rolls up." })
  siteUuid: string;

  @ApiProperty({ nullable: true, type: String, description: "Name of the site." })
  siteName: string | null;

  @ApiProperty({
    description:
      "Active polygons on this site that are not approved (draft, pending-approval, information-required). The gap between the two bases."
  })
  inReviewCount: number;

  @ApiProperty({
    type: SiteIndicatorBasisDto,
    description:
      "Active, APPROVED polygons only. This is the basis the rest of TerraMatch reports on — it matches the dashboard's totalHectaresRestoredSum. This is the destination basis."
  })
  approved: SiteIndicatorBasisDto;

  @ApiProperty({
    type: SiteIndicatorBasisDto,
    description: `Reproduces the existing client-side aggregate exactly, so the frontend can move onto this
endpoint without any number changing. Active polygons in EVERY status, and it deliberately mirrors two
client quirks: the latest tree cover year is chosen after discarding null percent_cover (so an older
non-null year can win), and polygons with zero or null calc_area are weighted 1 rather than excluded.

This basis exists only to make the data-source swap verifiable. Delete it once the UI moves to 'approved'.`
  })
  clientParity: SiteIndicatorBasisDto;
}

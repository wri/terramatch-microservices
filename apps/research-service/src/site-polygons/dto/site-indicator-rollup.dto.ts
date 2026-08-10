import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";

/**
 * The shape returned by the rollup query in SitePolygonsService.getIndicatorRollup. All numeric
 * fields arrive from the driver as strings or numbers depending on the aggregate, so the DTO
 * normalises them.
 */
export type SiteIndicatorRollupRow = {
  siteUuid: string;
  siteName: string | null;
  polygons: number | string;
  hectares: number | string | null;
  treeCoverWeightedMeanPct: number | string | null;
  treeCoverPolygonCount: number | string;
  treeCoverLossTotal: number | string | null;
};

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

@JsonApiDto({ type: "siteIndicatorRollups" })
export class SiteIndicatorRollupDto {
  constructor(row: SiteIndicatorRollupRow) {
    this.siteUuid = row.siteUuid;
    this.siteName = row.siteName;
    this.polygons = toNumber(row.polygons) ?? 0;
    this.hectares = toNumber(row.hectares);
    this.treeCoverWeightedMeanPct = toNumber(row.treeCoverWeightedMeanPct);
    this.treeCoverPolygonCount = toNumber(row.treeCoverPolygonCount) ?? 0;
    this.treeCoverLossTotal = toNumber(row.treeCoverLossTotal);

    // The honesty fraction: what proportion of this site's polygons actually contributed to the
    // tree cover mean. A summed or averaged measurement without this is not reportable.
    this.treeCoverCoverage = this.polygons > 0 ? this.treeCoverPolygonCount / this.polygons : null;
  }

  @ApiProperty({ description: "UUID of the site this row rolls up." })
  siteUuid: string;

  @ApiProperty({ nullable: true, type: String, description: "Name of the site." })
  siteName: string | null;

  @ApiProperty({ description: "Count of active, approved polygons on this site." })
  polygons: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: "Sum of calc_area over this site's active, approved polygons."
  })
  hectares: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      "Area-weighted mean of the latest-year percent_cover across this site's polygons. Null when no polygon has a tree cover value."
  })
  treeCoverWeightedMeanPct: number | null;

  @ApiProperty({
    description: "Number of polygons that contributed a latest-year tree cover row to the weighted mean."
  })
  treeCoverPolygonCount: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      "treeCoverPolygonCount / polygons. Render this alongside treeCoverWeightedMeanPct; a partial mean shown as complete is worse than no number."
  })
  treeCoverCoverage: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      "Not yet implemented — always null. Requires a per-year JSON parse over indicator_output_tree_cover_loss.value."
  })
  treeCoverLossTotal: number | null;
}

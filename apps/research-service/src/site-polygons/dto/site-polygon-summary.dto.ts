import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { POLYGON_STATUSES, PolygonStatus } from "@terramatch-microservices/database/constants";
import { SummaryFacet, SummaryIndicatorSlug } from "./site-polygon-summary-query.dto";

export class TreeCoverLossSummaryDto {
  @ApiProperty({
    type: "object",
    additionalProperties: { type: "number" },
    description: "Sum of hectares by year key from indicator values."
  })
  sumByYear: Record<string, number>;

  @ApiProperty()
  polygonsWithLoss: number;

  @ApiProperty()
  polygonsNoLoss: number;

  @ApiProperty()
  polygonsWithIndicator: number;

  @ApiProperty()
  polygonsMissing: number;
}

export class HectaresIndicatorSummaryDto {
  @ApiProperty({
    type: "object",
    additionalProperties: { type: "number" },
    description: "Sum of hectares by bucket key from indicator values."
  })
  sumByBucket: Record<string, number>;

  @ApiProperty()
  polygonsWithIndicator: number;

  @ApiProperty()
  polygonsMissing: number;
}

export type IndicatorSummaryDto = TreeCoverLossSummaryDto | HectaresIndicatorSummaryDto;

@JsonApiDto({ type: "sitePolygonSummaries", id: "string" })
export class SitePolygonSummaryDto {
  constructor(attrs: {
    sumNumTrees: number;
    sumCalcArea: number;
    minCalcArea: number | null;
    maxCalcArea: number | null;
    totalPolygons: number;
    countByStatus: Partial<Record<PolygonStatus, number>>;
    indicators?: Partial<Record<SummaryIndicatorSlug, IndicatorSummaryDto>>;
    facetCounts?: Partial<Record<SummaryFacet, Record<string, number>>>;
  }) {
    this.sumNumTrees = attrs.sumNumTrees;
    this.sumCalcArea = attrs.sumCalcArea;
    this.minCalcArea = attrs.minCalcArea;
    this.maxCalcArea = attrs.maxCalcArea;
    this.totalPolygons = attrs.totalPolygons;
    this.countByStatus = attrs.countByStatus;
    this.indicators = attrs.indicators;
    this.facetCounts = attrs.facetCounts;
  }

  @ApiProperty({ description: "Sum of numTrees across polygons in scope." })
  sumNumTrees: number;

  @ApiProperty({ description: "Sum of calcArea (ha) across polygons in scope." })
  sumCalcArea: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      "Smallest calcArea (ha) across polygons in scope; null when none have calcArea. " +
      "Request without calcAreaMin / calcAreaMax to get the full range for a range filter."
  })
  minCalcArea: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      "Largest calcArea (ha) across polygons in scope; null when none have calcArea. " +
      "Request without calcAreaMin / calcAreaMax to get the full range for a range filter."
  })
  maxCalcArea: number | null;

  @ApiProperty({ description: "Count of polygons in scope." })
  totalPolygons: number;

  @ApiProperty({
    type: "object",
    additionalProperties: { type: "number" },
    description: "Polygon counts keyed by status.",
    example: Object.fromEntries(POLYGON_STATUSES.map(status => [status, 0]))
  })
  countByStatus: Partial<Record<PolygonStatus, number>>;

  @ApiProperty({
    required: false,
    description: "Optional indicator aggregates keyed by requested indicatorSlug."
  })
  indicators?: Partial<Record<SummaryIndicatorSlug, IndicatorSummaryDto>>;

  @ApiProperty({
    required: false,
    type: Object,
    additionalProperties: { type: "object", additionalProperties: { type: "number" } },
    description:
      "Per-option polygon counts keyed by requested facet[], then by option value. Every known option is " +
      "present (0 when no polygons match). Each facet ignores its own filter but applies all others.",
    example: { practice: { "tree-planting": 12, "direct-seeding": 3, "assisted-natural-regeneration": 0 } }
  })
  facetCounts?: Partial<Record<SummaryFacet, Record<string, number>>>;
}

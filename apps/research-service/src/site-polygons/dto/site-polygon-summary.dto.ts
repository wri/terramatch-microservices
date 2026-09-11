import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { POLYGON_STATUSES, PolygonStatus } from "@terramatch-microservices/database/constants";
import { SummaryIndicatorSlug } from "./site-polygon-summary-query.dto";

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
    totalPolygons: number;
    countByStatus: Partial<Record<PolygonStatus, number>>;
    indicators?: Partial<Record<SummaryIndicatorSlug, IndicatorSummaryDto>>;
  }) {
    this.sumNumTrees = attrs.sumNumTrees;
    this.sumCalcArea = attrs.sumCalcArea;
    this.totalPolygons = attrs.totalPolygons;
    this.countByStatus = attrs.countByStatus;
    this.indicators = attrs.indicators;
  }

  @ApiProperty({ description: "Sum of numTrees across polygons in scope." })
  sumNumTrees: number;

  @ApiProperty({ description: "Sum of calcArea (ha) across polygons in scope." })
  sumCalcArea: number;

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
}

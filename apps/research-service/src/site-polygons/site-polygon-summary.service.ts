import { Injectable } from "@nestjs/common";
import { col, fn, Op } from "sequelize";
import { getStableRequestQuery } from "@terramatch-microservices/common/util";
import { POLYGON_STATUSES, PolygonStatus } from "@terramatch-microservices/database/constants";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import {
  HectaresIndicatorSummaryDto,
  IndicatorSummaryDto,
  SitePolygonSummaryDto,
  TreeCoverLossSummaryDto
} from "./dto/site-polygon-summary.dto";
import {
  SUMMARY_INDICATOR_SLUGS,
  SummaryIndicatorSlug,
  SitePolygonSummaryQueryDto
} from "./dto/site-polygon-summary-query.dto";
import { INDICATOR_MODEL_CLASSES } from "./site-polygon-column-query.builder";
import { SitePolygonMapIndexQueryBuilder } from "./site-polygon-map-index-query.builder";
import { applySitePolygonScopeFilters } from "./site-polygon-scope-filters";

const TREE_COVER_LOSS_SLUGS = new Set<SummaryIndicatorSlug>(["treeCoverLoss", "treeCoverLossFires"]);

type AggregateTotalsRow = {
  sumNumTrees: string | number | null;
  sumCalcArea: string | number | null;
  totalPolygons: string | number | null;
};

type StatusCountRow = {
  status: PolygonStatus | null;
  count: string | number;
};

type IndicatorValueRow = {
  sitePolygonId: number;
  yearOfAnalysis: number;
  value: Record<string, unknown> | null;
};

@Injectable()
export class SitePolygonSummaryService {
  async getSummary(query: SitePolygonSummaryQueryDto): Promise<SitePolygonSummaryDto> {
    const builder = new SitePolygonMapIndexQueryBuilder();
    await applySitePolygonScopeFilters(builder, query);

    const [base, indicators] = await Promise.all([
      this.buildBaseAggregates(builder),
      this.buildIndicatorAggregates(builder, query.indicatorSlug)
    ]);

    return new SitePolygonSummaryDto({
      ...base,
      ...(indicators != null ? { indicators } : {})
    });
  }

  getResourceId(query: SitePolygonSummaryQueryDto): string {
    return getStableRequestQuery(query);
  }

  private async buildBaseAggregates(builder: SitePolygonMapIndexQueryBuilder) {
    const [totalsRows, statusRows] = await Promise.all([
      SitePolygon.findAll({
        ...builder.findOptionsForAggregation([
          [fn("COALESCE", fn("SUM", col("num_trees")), 0), "sumNumTrees"],
          [fn("COALESCE", fn("SUM", col("calc_area")), 0), "sumCalcArea"],
          [fn("COUNT", col("SitePolygon.id")), "totalPolygons"]
        ]),
        raw: true
      }) as unknown as Promise<AggregateTotalsRow[]>,
      SitePolygon.findAll({
        ...builder.findOptionsForAggregation(["status", [fn("COUNT", col("SitePolygon.id")), "count"]]),
        group: ["status"],
        raw: true
      }) as unknown as Promise<StatusCountRow[]>
    ]);
    const totalsRow = totalsRows[0];

    const countByStatus = Object.fromEntries(POLYGON_STATUSES.map(status => [status, 0])) as Record<
      PolygonStatus,
      number
    >;
    for (const row of statusRows) {
      if (row.status != null && POLYGON_STATUSES.includes(row.status)) {
        countByStatus[row.status] = Number(row.count);
      }
    }

    return {
      sumNumTrees: Number(totalsRow?.sumNumTrees ?? 0),
      sumCalcArea: Number(totalsRow?.sumCalcArea ?? 0),
      totalPolygons: Number(totalsRow?.totalPolygons ?? 0),
      countByStatus
    };
  }

  private async buildIndicatorAggregates(
    builder: SitePolygonMapIndexQueryBuilder,
    indicatorSlugs?: SummaryIndicatorSlug[]
  ): Promise<Partial<Record<SummaryIndicatorSlug, IndicatorSummaryDto>> | undefined> {
    if (indicatorSlugs == null || indicatorSlugs.length === 0) {
      return undefined;
    }

    const uniqueSlugs = [...new Set(indicatorSlugs)].filter((slug): slug is SummaryIndicatorSlug =>
      (SUMMARY_INDICATOR_SLUGS as readonly string[]).includes(slug)
    );
    if (uniqueSlugs.length === 0) {
      return undefined;
    }

    const idRows = (await SitePolygon.findAll({
      ...builder.findOptionsForAggregation(["id"]),
      raw: true
    })) as unknown as Array<{ id: number }>;
    const polygonIds = idRows.map(row => row.id);
    const totalPolygons = polygonIds.length;

    if (totalPolygons === 0) {
      return Object.fromEntries(uniqueSlugs.map(slug => [slug, this.emptyIndicatorSummary(slug)])) as Partial<
        Record<SummaryIndicatorSlug, IndicatorSummaryDto>
      >;
    }

    const summaries = await Promise.all(
      uniqueSlugs.map(async slug => [slug, await this.summarizeIndicator(slug, polygonIds, totalPolygons)] as const)
    );

    return Object.fromEntries(summaries);
  }

  private emptyIndicatorSummary(slug: SummaryIndicatorSlug): IndicatorSummaryDto {
    if (TREE_COVER_LOSS_SLUGS.has(slug)) {
      return {
        sumByYear: {},
        polygonsWithLoss: 0,
        polygonsNoLoss: 0,
        polygonsWithIndicator: 0,
        polygonsMissing: 0
      };
    }

    return {
      sumByBucket: {},
      polygonsWithIndicator: 0,
      polygonsMissing: 0
    };
  }

  private async summarizeIndicator(
    slug: SummaryIndicatorSlug,
    polygonIds: number[],
    totalPolygons: number
  ): Promise<IndicatorSummaryDto> {
    const IndicatorClass = INDICATOR_MODEL_CLASSES[slug];
    const rows = (await IndicatorClass.findAll({
      where: {
        sitePolygonId: { [Op.in]: polygonIds },
        indicatorSlug: slug
      },
      attributes: ["sitePolygonId", "yearOfAnalysis", "value"],
      raw: true
    })) as unknown as IndicatorValueRow[];

    const latestByPolygon = this.pickLatestIndicatorRowPerPolygon(rows);

    if (TREE_COVER_LOSS_SLUGS.has(slug)) {
      return this.summarizeTreeCoverLoss(latestByPolygon, totalPolygons);
    }

    return this.summarizeHectares(latestByPolygon, totalPolygons);
  }

  private pickLatestIndicatorRowPerPolygon(rows: IndicatorValueRow[]): Map<number, Record<string, unknown>> {
    const yearByPolygon = new Map<number, number>();
    const byPolygon = new Map<number, Record<string, unknown>>();

    for (const row of rows) {
      if (row.value == null || typeof row.value !== "object") {
        continue;
      }
      const previousYear = yearByPolygon.get(row.sitePolygonId);
      if (previousYear != null && previousYear >= row.yearOfAnalysis) {
        continue;
      }
      yearByPolygon.set(row.sitePolygonId, row.yearOfAnalysis);
      byPolygon.set(row.sitePolygonId, row.value as Record<string, unknown>);
    }

    return byPolygon;
  }

  private summarizeTreeCoverLoss(
    valuesByPolygon: Map<number, Record<string, unknown>>,
    totalPolygons: number
  ): TreeCoverLossSummaryDto {
    const sumByYear: Record<string, number> = {};
    let polygonsWithLoss = 0;
    let polygonsNoLoss = 0;

    for (const value of valuesByPolygon.values()) {
      let polygonTotal = 0;
      for (const [year, raw] of Object.entries(value)) {
        const amount = this.toNumber(raw);
        if (amount == null) continue;
        sumByYear[year] = (sumByYear[year] ?? 0) + amount;
        polygonTotal += amount;
      }
      if (polygonTotal > 0) {
        polygonsWithLoss += 1;
      } else {
        polygonsNoLoss += 1;
      }
    }

    const polygonsWithIndicator = valuesByPolygon.size;
    return {
      sumByYear,
      polygonsWithLoss,
      polygonsNoLoss,
      polygonsWithIndicator,
      polygonsMissing: Math.max(0, totalPolygons - polygonsWithIndicator)
    };
  }

  private summarizeHectares(
    valuesByPolygon: Map<number, Record<string, unknown>>,
    totalPolygons: number
  ): HectaresIndicatorSummaryDto {
    const sumByBucket: Record<string, number> = {};

    for (const value of valuesByPolygon.values()) {
      for (const [bucket, raw] of Object.entries(value)) {
        const amount = this.toNumber(raw);
        if (amount == null) continue;
        sumByBucket[bucket] = (sumByBucket[bucket] ?? 0) + amount;
      }
    }

    const polygonsWithIndicator = valuesByPolygon.size;
    return {
      sumByBucket,
      polygonsWithIndicator,
      polygonsMissing: Math.max(0, totalPolygons - polygonsWithIndicator)
    };
  }

  private toNumber(value: unknown): number | null {
    if (value == null) return null;
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : null;
  }
}

import { BadRequestException, Injectable } from "@nestjs/common";
import { Project, Seeding, Site, SiteReport, TreeSpecies } from "@terramatch-microservices/database/entities";
import { cast, col, fn } from "sequelize";
import { Literal } from "sequelize/types/utils";
import { sortBy } from "lodash";
import { AggregateReportsEntityType } from "./dto/aggregate-reports-params.dto";
import { AggregateReportSeriesItemDto, AggregateReportsResponseDto } from "./dto/aggregate-reports-response.dto";
import { FrameworkKey } from "@terramatch-microservices/database/constants";
import { EntityModel } from "@terramatch-microservices/database/constants/entities";

const SUPPORTED_FRAMEWORKS: ReadonlySet<FrameworkKey> = new Set([
  "terrafund",
  "terrafund-landscapes",
  "enterprises",
  "terrafund-3",
  "ppc",
  "hbf"
]);

type AggregateReportCollectionKey = keyof AggregateReportsResponseDto;

const FRAMEWORK_COLLECTIONS: Record<string, ReadonlyArray<AggregateReportCollectionKey>> = {
  terrafund: ["treePlanted", "treesRegenerating"],
  "terrafund-landscapes": ["treePlanted", "treesRegenerating"],
  enterprises: ["treePlanted", "treesRegenerating"],
  "terrafund-3": ["treePlanted", "treesRegenerating"],
  ppc: ["treePlanted", "seedingRecords", "treesRegenerating"],
  hbf: ["treePlanted", "seedingRecords", "treesRegenerating"]
};

function toValidDueAt(value: Date | string | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toFiniteNumber(value: unknown): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function buildPeriodSeries(
  reportRows: SiteReport[],
  amountByReportId: Map<number, number>,
  getAmountFromRow: (row: SiteReport) => number
): AggregateReportSeriesItemDto[] {
  const withDueAt: { row: SiteReport; dueAt: Date }[] = [];
  const withNullDueAt: SiteReport[] = [];
  for (const row of reportRows) {
    const dueAt = toValidDueAt(row.dueAt);
    if (dueAt == null) withNullDueAt.push(row);
    else withDueAt.push({ row, dueAt });
  }

  let nullDueAmount = 0;
  for (const row of withNullDueAt) {
    nullDueAmount += amountByReportId.get(row.id) ?? getAmountFromRow(row);
  }

  const amountByDueTime = new Map<number, { dueAt: Date; amount: number }>();
  for (const { row, dueAt } of withDueAt) {
    const dueTime = dueAt.getTime();
    const periodAmount = amountByReportId.get(row.id) ?? getAmountFromRow(row);
    const existing = amountByDueTime.get(dueTime);
    if (existing == null) {
      amountByDueTime.set(dueTime, { dueAt, amount: periodAmount });
    } else {
      existing.amount += periodAmount;
    }
  }

  const sorted = sortBy(Array.from(amountByDueTime.values()), x => x.dueAt.getTime());
  const datedItems = sorted.map(period => ({
    dueDate: period.dueAt.toISOString(),
    aggregateAmount: period.amount
  }));

  const result: AggregateReportSeriesItemDto[] = [];
  if (withNullDueAt.length > 0) {
    result.push({ dueDate: null, aggregateAmount: nullDueAmount });
  }
  result.push(...datedItems);
  return result;
}

@Injectable()
export class AggregateReportsService {
  async getAggregateReports(
    entityType: AggregateReportsEntityType,
    entity: EntityModel
  ): Promise<AggregateReportsResponseDto> {
    const frameworkKey: FrameworkKey | null = entity.frameworkKey;
    if (frameworkKey == null) {
      throw new BadRequestException("Entity has no framework; aggregate reports are not supported.");
    }
    if (!SUPPORTED_FRAMEWORKS.has(frameworkKey)) {
      throw new BadRequestException(`Unsupported framework for aggregate reports: ${frameworkKey}`);
    }

    const collections = FRAMEWORK_COLLECTIONS[frameworkKey];
    if (collections == null || collections.length === 0) {
      return {};
    }

    const reports = await this.getApprovedReportRows(entityType, entity);
    const reportIds = reports.map(r => r.id);

    if (reportIds.length === 0) {
      return this.buildResponse(collections, [], [], [], []);
    }

    const [treePlantedByReport, seedingByReport, anrByReport, invasiveByReport] = await Promise.all([
      this.getTreePlantedByReportId(reportIds),
      this.getSeedingByReportId(reportIds),
      this.getAnrByReportId(reportIds),
      this.getInvasiveByReportId(reportIds)
    ]);

    const treePlantedSeries = buildPeriodSeries(reports, treePlantedByReport, () => 0);
    const seedingSeries = buildPeriodSeries(reports, seedingByReport, () => 0);
    const treesRegeneratingSeries = buildPeriodSeries(reports, anrByReport, () => 0);
    const invasiveSeries = buildPeriodSeries(reports, invasiveByReport, () => 0);

    return this.buildResponse(collections, treePlantedSeries, seedingSeries, treesRegeneratingSeries, invasiveSeries);
  }

  private async getApprovedReportRows(
    entityType: AggregateReportsEntityType,
    entity: EntityModel
  ): Promise<SiteReport[]> {
    if (entityType === "projects") {
      const project = entity instanceof Project ? entity : null;
      if (project == null) return [];
      const approvedSitesQuery: Literal = Site.approvedIdsSubquery(project.id);
      return SiteReport.approved()
        .sites(approvedSitesQuery)
        .findAll({
          attributes: ["id", "dueAt"],
          order: [["dueAt", "ASC"]]
        });
    }

    if (entityType === "sites") {
      const site = entity instanceof Site ? entity : null;
      if (site == null) return [];
      return SiteReport.approved()
        .sites([site.id])
        .findAll({
          attributes: ["id", "dueAt"],
          order: [["dueAt", "ASC"]]
        });
    }

    return [];
  }

  private async getTreePlantedByReportId(reportIds: number[]): Promise<Map<number, number>> {
    if (reportIds.length === 0) return new Map();

    const rows = (await TreeSpecies.visible()
      .collection("tree-planted")
      .siteReports(reportIds)
      .findAll({
        attributes: ["speciesableId", [cast(fn("SUM", col("amount")), "SIGNED"), "total"]],
        group: ["speciesableId"],
        raw: true
      })) as unknown as { speciesableId: number; total: number }[];

    const map = new Map<number, number>();
    for (const row of rows) {
      const total = toFiniteNumber(row?.total);
      if (row != null && total != null) {
        map.set(row.speciesableId, total);
      }
    }
    return map;
  }

  private async getAnrByReportId(reportIds: number[]): Promise<Map<number, number>> {
    if (reportIds.length === 0) return new Map();

    const rows = (await TreeSpecies.visible()
      .collection("anr")
      .siteReports(reportIds)
      .findAll({
        attributes: ["speciesableId", [cast(fn("SUM", col("amount")), "SIGNED"), "total"]],
        group: ["speciesableId"],
        raw: true
      })) as unknown as { speciesableId: number; total: number }[];

    const map = new Map<number, number>();
    for (const row of rows) {
      const total = toFiniteNumber(row?.total);
      if (row != null && total != null) {
        map.set(row.speciesableId, total);
      }
    }
    return map;
  }

  private async getInvasiveByReportId(reportIds: number[]): Promise<Map<number, number>> {
    if (reportIds.length === 0) return new Map();

    const rows = (await TreeSpecies.visible()
      .collection("invasive")
      .siteReports(reportIds)
      .findAll({
        attributes: ["speciesableId", [cast(fn("SUM", col("amount")), "SIGNED"), "total"]],
        group: ["speciesableId"],
        raw: true
      })) as unknown as { speciesableId: number; total: number }[];

    const map = new Map<number, number>();
    for (const row of rows) {
      const total = toFiniteNumber(row?.total);
      if (row != null && total != null) {
        map.set(row.speciesableId, total);
      }
    }
    return map;
  }

  private async getSeedingByReportId(reportIds: number[]): Promise<Map<number, number>> {
    if (reportIds.length === 0) return new Map();

    const rows = (await Seeding.visible()
      .siteReports(reportIds)
      .findAll({
        attributes: ["seedableId", [cast(fn("SUM", col("amount")), "SIGNED"), "total"]],
        group: ["seedableId"],
        raw: true
      })) as unknown as { seedableId: number; total: number }[];

    const map = new Map<number, number>();
    for (const row of rows) {
      const total = toFiniteNumber(row?.total);
      if (row != null && total != null) {
        map.set(row.seedableId, total);
      }
    }
    return map;
  }

  private buildResponse(
    collections: ReadonlyArray<AggregateReportCollectionKey>,
    treePlanted: AggregateReportSeriesItemDto[],
    seedingRecords: AggregateReportSeriesItemDto[],
    treesRegenerating: AggregateReportSeriesItemDto[],
    invasive: AggregateReportSeriesItemDto[]
  ): AggregateReportsResponseDto {
    const response: AggregateReportsResponseDto = {};
    if (collections.includes("treePlanted")) {
      response.treePlanted = treePlanted;
    }
    if (collections.includes("seedingRecords")) {
      response.seedingRecords = seedingRecords;
    }
    if (collections.includes("treesRegenerating")) {
      response.treesRegenerating = treesRegenerating;
    }
    if (collections.includes("invasive")) {
      response.invasive = invasive;
    }
    return response;
  }
}

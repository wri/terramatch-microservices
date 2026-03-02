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
  "ppc",
  "hbf"
]);

type AggregateReportCollectionKey = keyof AggregateReportsResponseDto;

const FRAMEWORK_COLLECTIONS: Record<string, ReadonlyArray<AggregateReportCollectionKey>> = {
  terrafund: ["treePlanted", "treesRegenerating"],
  "terrafund-landscapes": ["treePlanted", "treesRegenerating"],
  enterprises: ["treePlanted", "treesRegenerating"],
  ppc: ["treePlanted", "seedingRecords", "treesRegenerating"],
  hbf: ["treePlanted", "seedingRecords", "treesRegenerating"]
};

function buildPeriodSeries(
  reportRows: SiteReport[],
  amountByReportId: Map<number, number>,
  getAmountFromRow: (row: SiteReport) => number
): AggregateReportSeriesItemDto[] {
  const withDueAt = reportRows.filter((row): row is SiteReport & { dueAt: Date } => row.dueAt != null);
  const withNullDueAt = reportRows.filter(row => row.dueAt == null);

  let nullDueAmount = 0;
  for (const row of withNullDueAt) {
    nullDueAmount += amountByReportId.get(row.id) ?? getAmountFromRow(row);
  }

  const amountByDueTime = new Map<number, { dueAt: Date; amount: number }>();
  for (const row of withDueAt) {
    const dueTime = row.dueAt.getTime();
    const periodAmount = amountByReportId.get(row.id) ?? getAmountFromRow(row);
    const existing = amountByDueTime.get(dueTime);
    if (existing == null) {
      amountByDueTime.set(dueTime, { dueAt: row.dueAt, amount: periodAmount });
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
      return this.buildResponse(collections, [], [], []);
    }

    const [treePlantedByReport, seedingByReport] = await Promise.all([
      this.getTreePlantedByReportId(reportIds),
      this.getSeedingByReportId(reportIds)
    ]);

    const treePlantedSeries = buildPeriodSeries(reports, treePlantedByReport, () => 0);
    const seedingSeries = buildPeriodSeries(reports, seedingByReport, () => 0);
    const treesRegeneratingSeries = buildPeriodSeries(reports, new Map<number, number>(), (row): number => {
      const n = row.numTreesRegenerating;
      return n != null ? n : 0;
    });

    return this.buildResponse(collections, treePlantedSeries, seedingSeries, treesRegeneratingSeries);
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
          attributes: ["id", "dueAt", "numTreesRegenerating"],
          order: [["dueAt", "ASC"]]
        });
    }

    if (entityType === "sites") {
      const site = entity instanceof Site ? entity : null;
      if (site == null) return [];
      return SiteReport.approved()
        .sites([site.id])
        .findAll({
          attributes: ["id", "dueAt", "numTreesRegenerating"],
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
      if (row != null && Number.isFinite(row.total)) {
        map.set(row.speciesableId, row.total);
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
      if (row != null && Number.isFinite(row.total)) {
        map.set(row.seedableId, row.total);
      }
    }
    return map;
  }

  private buildResponse(
    collections: ReadonlyArray<AggregateReportCollectionKey>,
    treePlanted: AggregateReportSeriesItemDto[],
    seedingRecords: AggregateReportSeriesItemDto[],
    treesRegenerating: AggregateReportSeriesItemDto[]
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
    return response;
  }
}

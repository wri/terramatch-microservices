import { FinancialIndicator, FinancialReport, FundingType, Media } from "@terramatch-microservices/database/entities";
import { ExportAllOptions, ReportProcessor } from "./entity-processor";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { BadRequestException } from "@nestjs/common";
import { FinancialReportFullDto, FinancialReportLightDto } from "../dto/financial-report.dto";
import { FundingTypeDto } from "@terramatch-microservices/common/dto/funding-type.dto";
import {
  FinancialIndicatorDto,
  FinancialIndicatorMedia
} from "@terramatch-microservices/common/dto/financial-indicator.dto";
import { Op } from "sequelize";
import { ReportUpdateAttributes } from "../dto/entity-update.dto";
import { Dictionary, uniq } from "lodash";
import { DateTime } from "luxon";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { isNotNull } from "@terramatch-microservices/database/types/array";

const SIMPLE_FILTERS: (keyof EntityQueryDto)[] = ["status", "organisationUuid", "updateRequestStatus", "frameworkKey"];

const ASSOCIATION_FIELD_MAP = {
  organisationUuid: "$organisation.uuid$"
};

const CSV_COLUMNS: Dictionary<string> = {
  id: "ID",
  uuid: "UUID",
  organisationId: "Organisation ID",
  organisationName: "Organisation Name",
  status: "Status",
  yearOfReport: "Year of Report",
  currency: "Currency",
  financialStartMonth: "Financial Start Month",
  submittedAt: "Submitted At",
  createdAt: "Created At",
  updatedAt: "Updated At",
  financialIndicators: "Financial Indicators",
  fundingTypes: "Funding Types"
};

export class FinancialReportProcessor extends ReportProcessor<
  FinancialReport,
  FinancialReportLightDto,
  FinancialReportFullDto,
  ReportUpdateAttributes
> {
  readonly LIGHT_DTO = FinancialReportLightDto;
  readonly FULL_DTO = FinancialReportFullDto;

  async findOne(uuid: string) {
    return await FinancialReport.findOne({
      where: { uuid },
      include: [
        {
          association: "organisation",
          attributes: ["id", "uuid", "name", "type", "status"]
        },
        {
          association: "financialIndicators",
          attributes: ["id", "uuid", "collection", "description", "amount", "exchangeRate", "year"]
        }
      ]
    });
  }

  async findMany(query: EntityQueryDto) {
    const builder = await this.entitiesService.buildQuery(FinancialReport, query, [
      { association: "organisation", attributes: ["uuid", "name", "type"] }
    ]);

    if (query.sort?.field != null) {
      if (
        ["createdAt", "updatedAt", "submittedAt", "dueAt", "status", "updateRequestStatus", "yearOfReport"].includes(
          query.sort.field
        )
      ) {
        builder.order([[query.sort.field, query.sort.direction ?? "ASC"]]);
      } else if (query.sort.field === "organisationName") {
        builder.order([["organisation", "name", query.sort.direction ?? "ASC"]]);
      } else if (query.sort.field !== "id") {
        throw new BadRequestException(`Invalid sort field: ${query.sort.field}`);
      }
    }

    SIMPLE_FILTERS.forEach(term => {
      const field = ASSOCIATION_FIELD_MAP[term] ?? term;
      if (query[term] != null) {
        builder.where({ [field]: query[term] });
      }
    });

    if (query.search != null) {
      builder.where({
        [Op.or]: [
          { "$organisation.name$": { [Op.like]: `%${query.search}%` } },
          { title: { [Op.like]: `%${query.search}%` } }
        ]
      });
    }

    return { models: await builder.execute(), paginationTotal: await builder.paginationTotal() };
  }

  async getFullDto(financialReport: FinancialReport) {
    const fundingTypes = await this.getFundingTypes(financialReport);
    const financialIndicators = await this.getFinancialIndicatorsWithMedia(financialReport);
    const financialIndicatorsWithMedia = await Promise.all(financialIndicators);

    const dto = new FinancialReportFullDto(financialReport, {
      ...(await this.getFeedback(financialReport)),
      fundingTypes,
      financialCollection: financialIndicatorsWithMedia
    });

    await this.entitiesService.removeHiddenValues(financialReport, dto);

    return { id: financialReport.uuid, dto };
  }

  async getLightDto(financialReport: FinancialReport) {
    return { id: financialReport.uuid, dto: new FinancialReportLightDto(financialReport, {}) };
  }

  async exportAll({ response }: ExportAllOptions = {}) {
    const fileName = `Financial Reports Export ${DateTime.now().toFormat("yyyy-MM-dd HH:mm:ss")}.csv`;
    await this.entitiesService.writeCsv(fileName, response, CSV_COLUMNS, async addRow => {
      const builder = new PaginatedQueryBuilder(FinancialReport, 10, [
        {
          association: "organisation",
          attributes: ["uuid", "name"]
        }
      ]);

      for await (const page of batchFindAll(builder)) {
        await this.entitiesService.authorize("export", page);
        const orgUuids = uniq(page.map(report => report.organisationUuid).filter(isNotNull));
        const fundingTypes = await FundingType.findAll({
          where: { organisationId: orgUuids, financialReportId: null }
        });
        const indicators = await FinancialIndicator.findAll({
          where: { financialReportId: page.map(({ id }) => id) }
        });
        for (const report of page) {
          const reportIndicators = indicators.filter(ind => ind.financialReportId === report.id);
          const reportFunding = fundingTypes.filter(ft => ft.organisationUuid === report.organisationUuid);
          addRow(report, {
            financialIndicators: reportIndicators.map(
              ({ collection, amount, year }) => `${collection}:${amount}(${year})`
            ),
            fundingTypes: reportFunding.map(({ type, amount, year }) => `${type}:${amount}(${year})`)
          });
        }
      }
    });
  }

  protected async getFundingTypes(financialReport: FinancialReport) {
    const fundingTypes = await FundingType.financialReport(financialReport.id).findAll({
      include: [
        {
          association: "organisation",
          attributes: ["id", "uuid", "name"]
        }
      ]
    });
    return fundingTypes.map(
      ft =>
        new FundingTypeDto(ft, {
          entityType: "financialReports" as const,
          entityUuid: financialReport.uuid
        })
    );
  }

  protected async getFinancialIndicatorsWithMedia(financialReport: FinancialReport) {
    const financialIndicators = await FinancialIndicator.financialReport(financialReport.id).findAll();

    return financialIndicators.map(async fi => {
      const mediaCollection = await Media.for(fi).findAll();

      return new FinancialIndicatorDto(fi, {
        entityType: "financialIndicators" as const,
        entityUuid: fi.uuid,
        ...(this.entitiesService.mapMediaCollection(
          mediaCollection,
          FinancialIndicator.MEDIA,
          "nurseryReports",
          fi.uuid
        ) as FinancialIndicatorMedia)
      });
    });
  }
}

import { FinancialIndicator, FinancialReport, FundingType, Media } from "@terramatch-microservices/database/entities";
import { ExportAllOptions, ReportProcessor } from "./entity-processor";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { BadRequestException, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { FinancialReportFullDto, FinancialReportLightDto } from "../dto/financial-report.dto";
import { FundingTypeDto } from "@terramatch-microservices/common/dto/funding-type.dto";
import {
  FinancialIndicatorDto,
  FinancialIndicatorMedia
} from "@terramatch-microservices/common/dto/financial-indicator.dto";
import { Op } from "sequelize";
import { ReportUpdateAttributes } from "../dto/entity-update.dto";
import { Dictionary } from "lodash";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { Archiver } from "archiver";
import { Response } from "express";
import { timestampFileName } from "@terramatch-microservices/common/util/filenames";

const SIMPLE_FILTERS: (keyof EntityQueryDto)[] = ["status", "organisationUuid", "updateRequestStatus", "frameworkKey"];

const ASSOCIATION_FIELD_MAP = {
  organisationUuid: "$organisation.uuid$"
};

const ADMIN_CSV_COLUMNS: Dictionary<string> = {
  id: "ID",
  uuid: "UUID",
  organisationId: "Organisation ID",
  organisationName: "Organisation Name",
  status: "Status",
  yearOfReport: "Year of Report",
  submittedAt: "Submitted At",
  createdAt: "Created At",
  updatedAt: "Updated At"
};

const PD_CSV_COLUMNS: Dictionary<string> = {
  organisationName: "Organisation Name",
  status: "Status",
  yearOfReport: "Year of Report",
  submittedAt: "Submitted At",
  createdAt: "Created At",
  updatedAt: "Updated At"
};

const CSV_EXPORT_INCLUDES = [
  {
    association: "organisation",
    attributes: ["uuid", "name"]
  }
];

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

  async export(uuid: string, target: Response | Archiver) {
    const report = await FinancialReport.findOne({ where: { uuid }, include: CSV_EXPORT_INCLUDES });
    if (report == null) throw new NotFoundException();
    if (report.frameworkKey == null) throw new InternalServerErrorException("Cannot export without a framework key");

    const fileName = timestampFileName(`${report.organisationName} - Financial Report`);
    await this.entitiesService.entityExport("financialReports", PD_CSV_COLUMNS, [report], {
      frameworkKey: report.frameworkKey,
      fileName,
      target,
      ability: "export"
    });
  }

  async exportAll({ target, frameworkKey }: ExportAllOptions = {}) {
    if (target == null) throw new InternalServerErrorException("Target is required for financial report export");
    if (frameworkKey == null) throw new BadRequestException("Framework key is required");

    const builder = new PaginatedQueryBuilder(FinancialReport, 10, CSV_EXPORT_INCLUDES).where({
      "$organisation.is_test$": false,
      frameworkKey
    });
    await this.entitiesService.entityExport("financialReports", ADMIN_CSV_COLUMNS, builder, {
      target,
      frameworkKey,
      ability: "export"
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

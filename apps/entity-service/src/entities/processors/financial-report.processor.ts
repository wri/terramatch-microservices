import { FinancialReport, FundingType, FinancialIndicator, Media } from "@terramatch-microservices/database/entities";
import { ReportProcessor } from "./entity-processor";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { BadRequestException } from "@nestjs/common";
import { FinancialReportFullDto, FinancialReportLightDto } from "../dto/financial-report.dto";
import { FundingTypeDto } from "../dto/funding-type.dto";
import { FinancialIndicatorDto, FinancialIndicatorMedia } from "../dto/financial-indicator.dto";
import { Op } from "sequelize";
import { ReportUpdateAttributes } from "../dto/entity-update.dto";

const SIMPLE_FILTERS: (keyof EntityQueryDto)[] = ["status", "organisationUuid"];

const ASSOCIATION_FIELD_MAP = {
  organisationUuid: "$organisation.uuid$"
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
        builder.order([query.sort.field, query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "organisationName") {
        builder.order(["organisation", "name", query.sort.direction ?? "ASC"]);
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
      fundingTypes,
      financialCollection: financialIndicatorsWithMedia
    });

    return { id: financialReport.uuid, dto };
  }

  async getLightDto(financialReport: FinancialReport) {
    return { id: financialReport.uuid, dto: new FinancialReportLightDto(financialReport, {}) };
  }

  protected async getFundingTypes(financialReport: FinancialReport) {
    const fundingTypes = await FundingType.organisationByUuid(financialReport.organisation.uuid).findAll({
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
          entityType: "organisations" as const,
          entityUuid: financialReport.organisation.uuid
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

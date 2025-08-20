import { FinancialReport, FundingType } from "@terramatch-microservices/database/entities";
import { ReportProcessor } from "./entity-processor";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { BadRequestException } from "@nestjs/common";
import { FinancialReportFullDto, FinancialReportLightDto } from "../dto/financial-report.dto";
import { FundingTypeDto } from "../dto/funding-type.dto";
import { ReportUpdateAttributes } from "../dto/entity-update.dto";
import { Includeable, Op } from "sequelize";

const SIMPLE_FILTERS: (keyof EntityQueryDto)[] = ["status", "organisationUuid", "yearOfReport"];

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
          association: "financialCollection",
          attributes: ["id", "uuid", "collection", "description", "amount", "exchangeRate", "year"]
        }
      ]
    });
  }

  async findMany(query: EntityQueryDto) {
    const organisationAssociation: Includeable = {
      association: "organisation",
      attributes: ["id", "uuid", "name"]
    };

    const financialCollectionAssociation: Includeable = {
      association: "financialCollection",
      attributes: ["id", "uuid", "collection", "description", "amount", "exchangeRate", "year"]
    };

    const builder = await this.entitiesService.buildQuery(FinancialReport, query, [
      organisationAssociation,
      financialCollectionAssociation
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

    const dto = new FinancialReportFullDto(financialReport, { fundingTypes });

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
}

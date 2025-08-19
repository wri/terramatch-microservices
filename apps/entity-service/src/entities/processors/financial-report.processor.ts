import { FinancialReport } from "@terramatch-microservices/database/entities";
import { ReportProcessor } from "./entity-processor";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { BadRequestException } from "@nestjs/common";
import { FinancialReportFullDto, FinancialReportLightDto } from "../dto/financial-report.dto";
import { FinancialReportUpdateAttributes } from "../dto/entity-update.dto";
import { Includeable, Op } from "sequelize";
import { ReportStatus } from "@terramatch-microservices/database/constants/status";

const SIMPLE_FILTERS: (keyof EntityQueryDto)[] = ["status", "organisationUuid", "yearOfReport"];

const ASSOCIATION_FIELD_MAP = {
  organisationUuid: "$organisation.uuid$"
};

export class FinancialReportProcessor extends ReportProcessor<
  FinancialReport,
  FinancialReportLightDto,
  FinancialReportFullDto,
  FinancialReportUpdateAttributes
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
        { association: "createdByUser", attributes: ["id", "uuid", "firstName", "lastName"] },
        { association: "approvedByUser", attributes: ["id", "uuid", "firstName", "lastName"] },
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
    const dto = new FinancialReportFullDto(financialReport, {});

    return { id: financialReport.uuid, dto };
  }

  async getLightDto(financialReport: FinancialReport) {
    return { id: financialReport.uuid, dto: new FinancialReportLightDto(financialReport, {}) };
  }

  async update(financialReport: FinancialReport, attributes: FinancialReportUpdateAttributes): Promise<void> {
    const updateData: Partial<FinancialReport> = {};

    if (attributes.status !== undefined) {
      updateData.status = attributes.status as ReportStatus;
    }
    if (attributes.title !== undefined) {
      updateData.title = attributes.title;
    }
    if (attributes.yearOfReport !== undefined) {
      updateData.yearOfReport = attributes.yearOfReport;
    }
    if (attributes.dueAt !== undefined) {
      updateData.dueAt = attributes.dueAt;
    }
    if (attributes.submittedAt !== undefined) {
      updateData.submittedAt = attributes.submittedAt;
    }
    if (attributes.approvedAt !== undefined) {
      updateData.approvedAt = attributes.approvedAt;
    }
    if (attributes.completion !== undefined) {
      updateData.completion = attributes.completion;
    }
    if (attributes.feedback !== undefined) {
      updateData.feedback = attributes.feedback;
    }
    if (attributes.feedbackFields !== undefined) {
      updateData.feedbackFields = attributes.feedbackFields;
    }
    if (attributes.answers !== undefined) {
      updateData.answers = attributes.answers;
    }
    if (attributes.finStartMonth !== undefined) {
      updateData.finStartMonth = attributes.finStartMonth;
    }
    if (attributes.currency !== undefined) {
      updateData.currency = attributes.currency;
    }

    await financialReport.update(updateData);
  }
}

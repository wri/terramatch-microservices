import {
  FinancialReport,
  FundingType,
  FinancialIndicator,
  Media,
  Organisation,
  Form
} from "@terramatch-microservices/database/entities";
import { ReportProcessor } from "./entity-processor";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { BadRequestException } from "@nestjs/common";
import { FinancialReportFullDto, FinancialReportLightDto } from "../dto/financial-report.dto";
import { FundingTypeDto } from "../dto/funding-type.dto";
import { FinancialIndicatorDto, FinancialIndicatorMedia } from "../dto/financial-indicator.dto";
import { Op } from "sequelize";
import { ReportUpdateAttributes } from "../dto/entity-update.dto";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";

const SIMPLE_FILTERS: (keyof EntityQueryDto)[] = ["status", "organisationUuid", "updateRequestStatus"];

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
  private logger = new TMLogger(FinancialReportProcessor.name);

  async update(model: FinancialReport, update: ReportUpdateAttributes) {
    await super.update(model, update);

    if (update.status === "approved") {
      await this.processReportSpecificLogic(model);
    }
  }

  /**
   * Specific method for FinancialReport custom logic. This is called automatically when the report is approved
   */
  private async processReportSpecificLogic(model: FinancialReport): Promise<void> {
    const organisation = await Organisation.findByPk(model.organisationId);
    if (organisation == null) {
      this.logger.warn(`Organisation not found for FinancialReport ${model.uuid}`);
      return;
    }

    if (model.finStartMonth != null || model.currency != null) {
      const updateData: Partial<Organisation> = {};
      if (model.finStartMonth != null) updateData.finStartMonth = model.finStartMonth;
      if (model.currency != null) updateData.currency = model.currency;

      await organisation.update(updateData);
    }

    const reportIndicators = await FinancialIndicator.financialReport(model.id).findAll();
    const existingOrgIndicators = await FinancialIndicator.organisation(organisation.id).findAll();

    const orgIndicatorMap = new Map<string, FinancialIndicator>();
    existingOrgIndicators.forEach(indicator => {
      const key = `${indicator.year}-${indicator.collection}`;
      orgIndicatorMap.set(key, indicator);
    });

    const indicatorsToCreate: Partial<FinancialIndicator>[] = [];
    const indicatorsToUpdate: { id: number; data: Partial<FinancialIndicator> }[] = [];

    for (const reportIndicator of reportIndicators) {
      const key = `${reportIndicator.year}-${reportIndicator.collection}`;
      const orgIndicator = orgIndicatorMap.get(key);

      if (orgIndicator == null) {
        indicatorsToCreate.push({
          organisationId: organisation.id,
          year: reportIndicator.year,
          collection: reportIndicator.collection,
          amount: reportIndicator.amount,
          description: reportIndicator.description,
          exchangeRate: reportIndicator.exchangeRate
        });
      } else {
        indicatorsToUpdate.push({
          id: orgIndicator.id,
          data: {
            amount: reportIndicator.amount,
            description: reportIndicator.description,
            exchangeRate: reportIndicator.exchangeRate
          }
        });
      }
    }

    if (indicatorsToCreate.length > 0) {
      await FinancialIndicator.bulkCreate(indicatorsToCreate as FinancialIndicator[]);
    }

    if (indicatorsToUpdate.length > 0) {
      await Promise.all(indicatorsToUpdate.map(({ id, data }) => FinancialIndicator.update(data, { where: { id } })));
    }

    // Delete existing FundingTypes for this organisation where financial_report_id is null
    await FundingType.destroy({
      where: {
        organisationId: organisation.uuid,
        financialReportId: null
      }
    });

    // Get the funding types from the financial report
    const fundingTypes = await FundingType.financialReport(model.id).findAll();

    // Create new FundingTypes for the organisation based on the financial report data
    for (const fundingType of fundingTypes) {
      await FundingType.create({
        organisationId: organisation.uuid,
        source: fundingType.source,
        year: fundingType.year,
        type: fundingType.type,
        amount: fundingType.amount,
        financialReportId: null
      } as FundingType);
    }
  }

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

  async getForm() {
    if (this._form == null) {
      this._form = await Form.findOne({ where: { type: "financial-report" } });
    }
    return this._form;
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

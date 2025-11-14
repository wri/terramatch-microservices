import { FinancialIndicator, FinancialReport, Organisation } from "@terramatch-microservices/database/entities";
import { InternalServerErrorException, LoggerService } from "@nestjs/common";
import { RelationResourceCollector } from "./index";
import { Dictionary } from "lodash";
import { EmbeddedFinancialIndicatorDto } from "../dto/financial-indicator.dto";
import { Op, WhereAttributeHash } from "sequelize";

export function financialIndicatorsCollector(logger: LoggerService): RelationResourceCollector {
  const questions: Dictionary<string> = {};

  return {
    addField(_, modelType, questionUuid) {
      if (questions[modelType] != null) {
        logger.warn(`Duplicate field for financialIndicators on ${modelType}`);
      }
      questions[modelType] = questionUuid;
    },

    async collect(answers, models) {
      if (Object.keys(models).length > 1 || Object.keys(questions).length > 1) {
        throw new InternalServerErrorException("Only one model type at a time is supported for fundingTypes");
      }
      const modelType = Object.keys(models)[0];

      const financialIndicators = await FinancialIndicator.findAll({
        where:
          modelType === "organisations"
            ? { organisationId: models.organisations?.id, financialReportId: null }
            : { financialReportId: models.financialReports?.id },
        include: [
          { association: "organisation", attributes: ["finStartMonth", "currency"] },
          { association: "financialReport", attributes: ["finStartMonth", "currency"] }
        ]
      });

      answers[Object.values(questions)[0]] = financialIndicators.map(
        financialIndicator =>
          new EmbeddedFinancialIndicatorDto(financialIndicator, {
            startMonth:
              financialIndicator.financialReport?.finStartMonth ??
              financialIndicator.organisation?.finStartMonth ??
              null,
            currency: financialIndicator.financialReport?.currency ?? financialIndicator.organisation?.currency ?? null
          })
      );
    },

    async syncRelation(model, _, answer) {
      const isOrg = model instanceof Organisation;
      if (!isOrg && !(model instanceof FinancialReport)) {
        throw new InternalServerErrorException("Only orgs and financialReports are supported for financialIndicators");
      }

      const orgId = isOrg ? model.id : model.organisationId;
      const indicatorWhere: WhereAttributeHash<FinancialIndicator> = isOrg
        ? { organisationId: orgId, financialReportId: null }
        : { financialReportId: model.id };
      if (answer == null || answer.length === 0) {
        await FinancialIndicator.destroy({ where: indicatorWhere });
        return;
      }

      const includedIds: number[] = [];
      const indicators = await FinancialIndicator.findAll({ where: indicatorWhere });
      const dtos = answer as EmbeddedFinancialIndicatorDto[];
      await Promise.all(
        dtos.map(async dto => {
          let existing = indicators.find(({ uuid }) => uuid === dto.uuid);

          if (existing == null) {
            existing = await FinancialIndicator.create({
              organisationId: orgId,
              financialReportId: isOrg ? null : model.id,
              collection: dto.collection,
              amount: dto.amount,
              year: dto.year,
              description: dto.description,
              exchangeRate: dto.exchangeRate
            });
          } else {
            await existing.update({
              collection: dto.collection,
              amount: dto.amount,
              year: dto.year,
              description: dto.description,
              exchangeRate: dto.exchangeRate
            });
          }
          includedIds.push(existing.id);
        })
      );

      await FinancialIndicator.destroy({ where: { ...indicatorWhere, id: { [Op.notIn]: includedIds } } });

      const { startMonth, currency } = dtos[0];
      if (startMonth != null || currency != null) {
        model.finStartMonth = startMonth;
        model.currency = currency ?? model.currency;
        await model.save();
      }
    }
  };
}

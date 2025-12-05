import { FinancialIndicator, FinancialReport, Organisation } from "@terramatch-microservices/database/entities";
import { InternalServerErrorException, LoggerService } from "@nestjs/common";
import { RelationResourceCollector } from "./index";
import { Dictionary } from "lodash";
import { EmbeddedFinancialIndicatorDto } from "../../dto/financial-indicator.dto";
import { CreationAttributes, Op } from "sequelize";
import { isNotNull } from "@terramatch-microservices/database/types/array";

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
      if (models.organisations != null && models.financialReports != null) {
        throw new InternalServerErrorException(
          "Only one of financialReports or organisations can be set for financialIndicators."
        );
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
      const scope = isOrg ? FinancialIndicator.organisation(orgId) : FinancialIndicator.financialReport(model.id);
      if (answer == null || answer.length === 0) {
        await scope.destroy();
        return;
      }

      const dtos = answer as EmbeddedFinancialIndicatorDto[];
      const dtoUuids = dtos.map(({ uuid }) => uuid).filter(isNotNull);
      if (dtoUuids.length === 0) {
        await scope.destroy();
      } else {
        await scope.destroy({ where: { uuid: { [Op.notIn]: dtoUuids } } });
      }

      const toCreate: CreationAttributes<FinancialIndicator>[] = [];
      const indicators = await scope.findAll();
      await Promise.all(
        dtos.map(async dto => {
          const existing = indicators.find(({ uuid }) => uuid === dto.uuid);

          if (existing != null) {
            await existing.update({
              collection: dto.collection,
              amount: dto.amount,
              year: dto.year,
              description: dto.description,
              exchangeRate: dto.exchangeRate
            });
          } else {
            const creationUuid =
              dto.uuid == null || (await FinancialIndicator.count({ where: { uuid: dto.uuid }, paranoid: false })) !== 0
                ? undefined
                : dto.uuid;
            toCreate.push({
              uuid: creationUuid,
              organisationId: orgId,
              financialReportId: isOrg ? null : model.id,
              collection: dto.collection,
              amount: dto.amount,
              year: dto.year,
              description: dto.description,
              exchangeRate: dto.exchangeRate
            });
          }
        })
      );

      if (toCreate.length > 0) await FinancialIndicator.bulkCreate(toCreate);

      const { startMonth, currency } = dtos[0];
      if (startMonth != null || currency != null) {
        model.finStartMonth = startMonth;
        model.currency = currency ?? model.currency;
        await model.save();
      }
    }
  };
}

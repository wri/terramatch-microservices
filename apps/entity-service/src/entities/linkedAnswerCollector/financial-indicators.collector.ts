import { FinancialIndicator } from "@terramatch-microservices/database/entities";
import { InternalServerErrorException, LoggerService } from "@nestjs/common";
import { RelationResourceCollector } from "./index";
import { Dictionary } from "lodash";
import { EmbeddedFinancialIndicatorDto } from "../dto/financial-indicator.dto";

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

    async syncRelation() {
      // TODO TM-2624
    }
  };
}

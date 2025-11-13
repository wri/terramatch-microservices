import { FundingType } from "@terramatch-microservices/database/entities";
import { InternalServerErrorException, LoggerService } from "@nestjs/common";
import { ResourceCollector } from "./index";
import { LinkedRelation } from "@terramatch-microservices/database/constants/linked-fields";
import { Dictionary } from "lodash";
import { EmbeddedFundingTypeDto } from "../dto/funding-type.dto";

export function fundingTypesCollector(logger: LoggerService): ResourceCollector<LinkedRelation> {
  const questions: Dictionary<string> = {};

  return {
    addField(_, modelType, questionUuid) {
      if (questions[modelType] != null) {
        logger.warn(`Duplicate field for fundingTypes on ${modelType}`);
      }
      questions[modelType] = questionUuid;
    },

    async collect(answers, models) {
      if (Object.keys(models).length > 1 || Object.keys(questions).length > 1) {
        throw new InternalServerErrorException("Only one model type at a time is supported for fundingTypes");
      }
      const modelType = Object.keys(models)[0];

      const fundingTypes = await FundingType.findAll({
        where:
          modelType === "organisations"
            ? { organisationId: models.organisations?.id, financialReportId: null }
            : { financialReportId: models.financialReports?.id },
        attributes: ["uuid", "year", "type", "source", "amount"]
      });

      answers[Object.values(questions)[0]] = fundingTypes.map(fundingType => new EmbeddedFundingTypeDto(fundingType));
    }
  };
}

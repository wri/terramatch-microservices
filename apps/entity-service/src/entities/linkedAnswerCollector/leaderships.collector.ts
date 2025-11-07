import { Leadership } from "@terramatch-microservices/database/entities";
import { InternalServerErrorException, LoggerService } from "@nestjs/common";
import { ResourceCollector } from "./index";
import { LinkedRelation } from "@terramatch-microservices/database/constants/linked-fields";
import { Dictionary } from "lodash";
import { Op } from "sequelize";
import { EmbeddedLeadershipDto } from "@terramatch-microservices/common/dto/leadership.dto";

export function leadershipsCollector(logger: LoggerService): ResourceCollector<LinkedRelation> {
  const questions: Dictionary<string> = {};

  return {
    addField(field, modelType, questionUuid) {
      if (modelType !== "organisations") {
        throw new InternalServerErrorException("ownership stake is only supported on org");
      }
      if (field.collection == null) {
        throw new InternalServerErrorException("collection not found for leaderships");
      }

      if (questions[field.collection] != null) {
        logger.warn(`Duplicate field for leaderships in ${field.collection} on orgs`);
      }
      questions[field.collection] = questionUuid;
    },

    async collect(answers, models) {
      if (models.organisations == null) {
        logger.warn("missing org for ownership stake");
        return;
      }

      const leaderships = await Leadership.findAll({
        where: {
          organisationId: models.organisations.id,
          collection: { [Op.in]: Object.keys(questions) }
        }
      });

      for (const [collection, questionUuid] of Object.entries(questions)) {
        answers[questionUuid] = leaderships
          .filter(leadership => leadership.collection === collection)
          .map(leadership => new EmbeddedLeadershipDto(leadership));
      }
    }
  };
}

import { Leadership, Organisation } from "@terramatch-microservices/database/entities";
import { InternalServerErrorException, LoggerService } from "@nestjs/common";
import { RelationResourceCollector } from "./index";
import { Dictionary } from "lodash";
import { Op } from "sequelize";
import { EmbeddedLeadershipDto } from "@terramatch-microservices/common/dto/leadership.dto";
import { scopedSync } from "./utils";

const leadershipsSync = scopedSync(
  Leadership,
  EmbeddedLeadershipDto,
  (model, field) => {
    if (!(model instanceof Organisation)) {
      throw new InternalServerErrorException("Only orgs are supported for leaderships");
    }
    if (field.collection == null) {
      throw new InternalServerErrorException("No collection found for leaderships field");
    }
    return Leadership.organisation(model.id).collection(field.collection);
  },
  (model, field) => ({ organisationId: model.id, collection: field.collection })
);

export function leadershipsCollector(logger: LoggerService): RelationResourceCollector {
  const questions: Dictionary<string> = {};

  return {
    addField(field, modelType, questionUuid) {
      if (modelType !== "organisations") {
        throw new InternalServerErrorException("leaderships is only supported on org");
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
        logger.warn("missing org for leaderships");
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
    },

    syncRelation: (...args) => leadershipsSync(...args, logger)
  };
}

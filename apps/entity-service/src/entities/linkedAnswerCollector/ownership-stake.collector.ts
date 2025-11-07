import { OwnershipStake } from "@terramatch-microservices/database/entities";
import { InternalServerErrorException, LoggerService } from "@nestjs/common";
import { ResourceCollector } from "./index";
import { LinkedRelation } from "@terramatch-microservices/database/constants/linked-fields";
import { EmbeddedOwnershipStakeDto } from "@terramatch-microservices/common/dto/ownership-stake.dto";

export function ownershipStakeCollector(logger: LoggerService): ResourceCollector<LinkedRelation> {
  let questionUuid: string;

  return {
    addField(_, modelType, addQuestionUuid) {
      if (modelType !== "organisations")
        throw new InternalServerErrorException("ownership stake is only supported on org");
      if (questionUuid != null) {
        logger.warn("Duplicate field for ownership stake on orgs");
      }
      questionUuid = addQuestionUuid;
    },

    async collect(answers, models) {
      if (models.organisations == null) {
        logger.warn("missing org for ownership stake");
        return;
      }

      const stake = await OwnershipStake.findOne({ where: { organisationId: models.organisations.id } });
      answers[questionUuid] = stake == null ? [] : [new EmbeddedOwnershipStakeDto(stake)];
    }
  };
}

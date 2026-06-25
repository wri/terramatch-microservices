import { Organisation, OwnershipStake } from "@terramatch-microservices/database/entities";
import { InternalServerErrorException, LoggerService } from "@nestjs/common";
import { RelationResourceCollector } from "./index";
import { EmbeddedOwnershipStakeDto } from "../../dto/ownership-stake.dto";
import { attributeExporter, scopedSync } from "./utils";

export function ownershipStakeCollector(logger: LoggerService): RelationResourceCollector {
  // This has to be created when the collector factory is created instead at module init because
  // the model has to have been initialized with a Sequelize instance first.
  const ownershipStakeSync = scopedSync(
    OwnershipStake,
    EmbeddedOwnershipStakeDto,
    model => {
      if (!(model instanceof Organisation)) {
        throw new InternalServerErrorException("Only orgs are supported for ownershipStakes");
      }
      return OwnershipStake.organisation(model.uuid);
    },
    model => ({ organisationId: model.uuid })
  );

  let questionName: string;

  return {
    addField(_, modelType, addQuestionName) {
      if (modelType !== "organisations") {
        throw new InternalServerErrorException("ownership stake is only supported on org");
      }
      if (questionName != null) {
        logger.warn("Duplicate field for ownership stake on orgs");
      }
      questionName = addQuestionName;
    },

    async collect(answers, models, { forExport }) {
      if (models.organisations == null) {
        throw new InternalServerErrorException("missing org for ownership stake");
      }

      const stakes = await OwnershipStake.organisation(models.organisations.uuid).findAll();
      answers[questionName] = forExport
        ? stakes.map(attributeExporter(["firstName", "lastName", "title", "gender", "percentOwnership", "yearOfBirth"]))
        : stakes.map(stake => new EmbeddedOwnershipStakeDto(stake));
    },

    syncRelation: (...args) => ownershipStakeSync(...args, logger),

    // Only used in the lower-env only testing feature "clear reports", not covered in specs.
    /* istanbul ignore next */
    async clearRelations(model) {
      if (!(model instanceof Organisation)) {
        throw new InternalServerErrorException("Only orgs are supported for ownership stake");
      }
      await OwnershipStake.destroy({ where: { organisationId: model.uuid } });
    }
  };
}

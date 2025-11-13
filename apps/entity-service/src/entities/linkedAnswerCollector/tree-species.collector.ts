import { polymorphicCollector, RelationSync } from "./utils";
import { TreeSpecies } from "@terramatch-microservices/database/entities";
import { EmbeddedTreeSpeciesDto } from "../dto/tree-species.dto";
import { CreationAttributes } from "sequelize";
import { laravelType } from "@terramatch-microservices/database/types/util";

const syncTreeSpecies: RelationSync = async (model, field, answer, hidden, logger) => {
  if (field.collection == null) {
    logger.warn("Tree species field missing collection", field);
    return;
  }

  const answers = (answer ?? []) as EmbeddedTreeSpeciesDto[];
  const answerUuids = answers.map(({ uuid }) => uuid);
  const trees = await TreeSpecies.for(model).collection(field.collection).findAll();
  const toDestroy = trees.map(({ uuid }) => uuid).filter(uuid => !answerUuids.includes(uuid));
  if (toDestroy.length > 0) {
    await TreeSpecies.destroy({ where: { uuid: toDestroy } });
  }

  const toCreate: CreationAttributes<TreeSpecies>[] = [];
  await Promise.all(
    answers.map(async answer => {
      if (answer.collection != null && answer.collection !== field.collection) {
        logger.error("Tree answer has an invalid collection set", { treeAnswer: answer, field });
      }

      const { name, amount, taxonId } = answer;
      const current = trees.find(({ uuid }) => uuid === answer.uuid);
      if (current != null) {
        await current.update({ name, amount, taxonId, hidden });
      } else {
        // Keep the UUID from the client if one was provided, but protect against collisions in the DB
        const uuid =
          answer.uuid == null || (await TreeSpecies.count({ where: { uuid: answer.uuid }, paranoid: false })) > 0
            ? undefined
            : answer.uuid;
        toCreate.push({
          speciesableType: laravelType(model),
          speciesableId: model.id,
          collection: field.collection,
          uuid,
          name,
          amount,
          taxonId,
          hidden
        });
      }
    })
  );

  if (toCreate.length > 0) {
    await TreeSpecies.bulkCreate(toCreate);
  }
};

export const treeSpeciesCollector = polymorphicCollector(TreeSpecies, EmbeddedTreeSpeciesDto, syncTreeSpecies);

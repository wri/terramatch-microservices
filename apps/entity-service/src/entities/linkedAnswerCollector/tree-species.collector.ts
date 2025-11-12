import { collectionCollector } from "./utils";
import { TreeSpecies } from "@terramatch-microservices/database/entities";
import { EmbeddedTreeSpeciesDto } from "../dto/tree-species.dto";
import { CreationAttributes } from "sequelize";
import { laravelType } from "@terramatch-microservices/database/types/util";

export const treeSpeciesCollector = collectionCollector(
  "treeSpecies",
  TreeSpecies,
  "speciesableType",
  "speciesableId",
  { attributes: ["uuid", "name", "amount", "taxonId", "collection", "speciesableType"] },
  treeSpecies => new EmbeddedTreeSpeciesDto(treeSpecies),

  async (model, field, answer, hidden, logger) => {
    if (field.collection == null) {
      logger.warn("Tree species field missing collection", field);
      return;
    }

    const treeAnswers = (answer ?? []) as EmbeddedTreeSpeciesDto[];
    const answerUuids = treeAnswers.map(({ uuid }) => uuid);
    const trees = await TreeSpecies.for(model).collection(field.collection).findAll();
    const toDestroy = trees.map(({ uuid }) => uuid).filter(uuid => !answerUuids.includes(uuid));
    if (toDestroy.length > 0) {
      await TreeSpecies.destroy({ where: { uuid: toDestroy } });
    }

    const toCreate: CreationAttributes<TreeSpecies>[] = [];
    await Promise.all(
      treeAnswers.map(async treeAnswer => {
        if (treeAnswer.collection != null && treeAnswer.collection !== field.collection) {
          logger.error("Tree answer has an invalid collection set", { treeAnswer, field });
        }

        const { name, amount, taxonId } = treeAnswer;
        const current = trees.find(({ uuid }) => uuid === treeAnswer.uuid);
        if (current != null) {
          await current.update({ name, amount, taxonId, hidden });
        } else {
          // Keep the UUID from the client if one was provided, but protect against collisions in the DB
          const uuid =
            treeAnswer.uuid == null ||
            (await TreeSpecies.count({ where: { uuid: treeAnswer.uuid }, paranoid: false })) > 0
              ? undefined
              : treeAnswer.uuid;
          toCreate.push({
            speciesableType: laravelType(model),
            speciesableId: model.id,
            collection: field.collection,
            uuid,
            name,
            amount,
            taxonId,
            hidden
          } as CreationAttributes<TreeSpecies>);
        }
      })
    );

    if (toCreate.length > 0) {
      await TreeSpecies.bulkCreate(toCreate);
    }
  }
);

import { Strata } from "@terramatch-microservices/database/entities";
import { RelationSync, singleAssociationCollection } from "./utils";
import { EmbeddedStrataDto } from "../dto/strata.dto";
import { CreationAttributes } from "sequelize";
import { laravelType } from "@terramatch-microservices/database/types/util";

const syncStratas: RelationSync = async (model, _, answer, hidden) => {
  const answers = (answer ?? []) as EmbeddedStrataDto[];
  const answerUuids = answers.map(({ uuid }) => uuid);
  const stratas = await Strata.for(model).findAll();
  const toDestroy = stratas.map(({ uuid }) => uuid).filter(uuid => !answerUuids.includes(uuid));
  if (toDestroy.length > 0) {
    await Strata.destroy({ where: { uuid: toDestroy } });
  }

  const toCreate: CreationAttributes<Strata>[] = [];
  await Promise.all(
    answers.map(async answer => {
      const { extent, description } = answer;
      const current = stratas.find(({ uuid }) => uuid === answer.uuid);
      if (current != null) {
        await current.update({ extent, description, hidden });
      } else {
        const uuid =
          answer.uuid == null || (await Strata.count({ where: { uuid: answer.uuid }, paranoid: false })) > 0
            ? undefined
            : answer.uuid;
        toCreate.push({
          stratasableType: laravelType(model),
          stratasableId: model.id,
          uuid,
          extent,
          description,
          hidden
        });
      }
    })
  );

  if (toCreate.length > 0) {
    await Strata.bulkCreate(toCreate);
  }
};

export const stratasCollector = singleAssociationCollection(Strata, EmbeddedStrataDto, syncStratas);

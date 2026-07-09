import { Project, Site } from "../entities";
import { ModelStatic } from "sequelize";

export const setPpcExternalId =
  <T extends Project | Site>(ctor: ModelStatic<T>) =>
  async (model: T) => {
    if (model.frameworkKey !== "ppc" || model.ppcExternalId != null) return;

    if (model.id != null) {
      // make sure that the ppc id is really not set if this is an update
      const lacksId = (await ctor.count({ where: { id: model.id, ppcExternalId: null }, paranoid: false })) > 0;
      if (!lacksId) return;
    }

    model.ppcExternalId = (((await ctor.max("ppcExternalId", { paranoid: false })) as number | null) ?? 0) + 1;
  };

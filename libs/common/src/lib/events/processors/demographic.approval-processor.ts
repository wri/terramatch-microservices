import { EntityApprovalProcessor } from "./types";
import { Demographic, DemographicEntry } from "@terramatch-microservices/database/entities";

export const DemographicApprovalProcessor: EntityApprovalProcessor = {
  async processEntityApproval(entity) {
    const ids = (await Demographic.for(entity).findAll({ where: { hidden: true }, attributes: ["id"] })).map(
      ({ id }) => id
    );
    if (ids.length === 0) return;

    await DemographicEntry.destroy({ where: { demographicId: ids } });
    await Demographic.destroy({ where: { id: ids } });
  }
};

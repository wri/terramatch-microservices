import { EntityApprovalProcessor } from "./types";
import {
  Tracking,
  TrackingEntry,
  Disturbance,
  Invasive,
  Seeding,
  Strata,
  TreeSpecies
} from "@terramatch-microservices/database/entities";
import {
  laravelType,
  polymorphicAttributes,
  PolymorphicModel,
  PolymorphicModelCtor
} from "@terramatch-microservices/database/types/util";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";
import { EntityModel } from "@terramatch-microservices/database/constants/entities";
import { Op } from "sequelize";

const hiddenIds = <M extends PolymorphicModel & { hidden: boolean | null }>(
  modelClass: PolymorphicModelCtor<M>,
  entity: EntityModel
) => {
  const { typeAttribute, idAttribute } = polymorphicAttributes(modelClass);
  return Subquery.select(modelClass, "id")
    .eq(typeAttribute, laravelType(entity))
    .eq(idAttribute, entity.id)
    .eq("hidden", true).literal;
};

// All related resources that don't have their own processing should soft delete hidden records
// at the time of approval
export const HiddenRelationsApprovalProcessor: EntityApprovalProcessor = {
  async processEntityApproval(entity) {
    const trackingIds = hiddenIds(Tracking, entity);
    await TrackingEntry.destroy({ where: { trackingId: { [Op.in]: trackingIds } } });
    await Tracking.destroy({ where: { id: { [Op.in]: trackingIds } } });
    await TreeSpecies.destroy({ where: { id: { [Op.in]: hiddenIds(TreeSpecies, entity) } } });
    await Disturbance.destroy({ where: { id: { [Op.in]: hiddenIds(Disturbance, entity) } } });
    await Invasive.destroy({ where: { id: { [Op.in]: hiddenIds(Invasive, entity) } } });
    await Seeding.destroy({ where: { id: { [Op.in]: hiddenIds(Seeding, entity) } } });
    await Strata.destroy({ where: { id: { [Op.in]: hiddenIds(Strata, entity) } } });
  }
};

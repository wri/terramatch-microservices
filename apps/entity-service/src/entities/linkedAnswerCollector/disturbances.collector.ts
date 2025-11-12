import { Disturbance } from "@terramatch-microservices/database/entities";
import { RelationSync, singleAssociationCollection } from "./utils";
import { EmbeddedDisturbanceDto } from "../dto/disturbance.dto";

const syncDisturbances: RelationSync = async () => {
  // TODO TM-2624
};

export const disturbancesCollector = singleAssociationCollection(Disturbance, EmbeddedDisturbanceDto, syncDisturbances);

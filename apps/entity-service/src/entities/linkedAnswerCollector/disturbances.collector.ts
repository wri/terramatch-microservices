import { Disturbance } from "@terramatch-microservices/database/entities";
import { polymorphicCollector, RelationSync } from "./utils";
import { EmbeddedDisturbanceDto } from "../dto/disturbance.dto";

const syncDisturbances: RelationSync = async () => {
  // TODO TM-2624
};

export const disturbancesCollector = polymorphicCollector(Disturbance, EmbeddedDisturbanceDto, syncDisturbances);

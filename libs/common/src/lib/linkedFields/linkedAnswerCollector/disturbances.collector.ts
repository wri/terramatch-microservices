import { Disturbance } from "@terramatch-microservices/database/entities";
import { polymorphicCollector } from "./utils";
import { EmbeddedDisturbanceDto } from "../../dto/disturbance.dto";

export const disturbancesCollector = polymorphicCollector(Disturbance, EmbeddedDisturbanceDto, {
  usesCollection: false
});

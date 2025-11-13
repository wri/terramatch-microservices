import { Disturbance } from "@terramatch-microservices/database/entities";
import { singleAssociationCollection } from "./utils";
import { EmbeddedDisturbanceDto } from "../dto/disturbance.dto";

export const disturbancesCollector = singleAssociationCollection(
  "disturbances",
  Disturbance,
  "disturbanceableType",
  "disturbanceableId",
  { attributes: ["uuid", "disturbanceableType", "type", "intensity", "extent", "description"] },
  disturbance => new EmbeddedDisturbanceDto(disturbance)
);

import { Disturbance } from "@terramatch-microservices/database/entities";
import { singlePropertyCollector } from "./utils";
import { EmbeddedDisturbanceDto } from "../dto/disturbance.dto";

export const disturbancesCollector = singlePropertyCollector(
  "disturbances",
  Disturbance,
  "disturbanceableType",
  "disturbanceableId",
  { attributes: ["uuid", "disturbanceableType", "type", "intensity", "extent", "description"] },
  disturbance => new EmbeddedDisturbanceDto(disturbance)
);

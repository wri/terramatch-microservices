import { Invasive } from "@terramatch-microservices/database/entities";
import { singlePropertyCollector } from "./utils";
import { EmbeddedInvasiveDto } from "../dto/invasive.dto";

export const invasivesCollector = singlePropertyCollector(
  "invasives",
  Invasive,
  "invasiveableType",
  "invasiveableId",
  { attributes: ["uuid", "invasiveableType", "type", "name"] },
  invasive => new EmbeddedInvasiveDto(invasive)
);

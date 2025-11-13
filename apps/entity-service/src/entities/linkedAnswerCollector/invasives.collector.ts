import { Invasive } from "@terramatch-microservices/database/entities";
import { singleAssociationCollection } from "./utils";
import { EmbeddedInvasiveDto } from "../dto/invasive.dto";

export const invasivesCollector = singleAssociationCollection(
  "invasives",
  Invasive,
  "invasiveableType",
  "invasiveableId",
  { attributes: ["uuid", "invasiveableType", "type", "name"] },
  invasive => new EmbeddedInvasiveDto(invasive)
);

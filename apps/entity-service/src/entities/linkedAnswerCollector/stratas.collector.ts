import { Strata } from "@terramatch-microservices/database/entities";
import { singleAssociationCollection } from "./utils";
import { EmbeddedStrataDto } from "../dto/strata.dto";

export const stratasCollector = singleAssociationCollection(
  "stratas",
  Strata,
  "stratasableType",
  "stratasableId",
  { attributes: ["uuid", "stratasableType", "description", "extent"] },
  strata => new EmbeddedStrataDto(strata)
);

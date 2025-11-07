import { Strata } from "@terramatch-microservices/database/entities";
import { singlePropertyCollector } from "./utils";
import { EmbeddedStrataDto } from "../dto/strata.dto";

export const stratasCollector = singlePropertyCollector(
  "stratas",
  Strata,
  "stratasableType",
  "stratasableId",
  { attributes: ["uuid", "stratasableType", "description", "extent"] },
  strata => new EmbeddedStrataDto(strata)
);

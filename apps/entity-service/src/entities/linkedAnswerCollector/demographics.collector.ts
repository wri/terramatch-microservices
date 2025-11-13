import { Demographic } from "@terramatch-microservices/database/entities";
import { EmbeddedDemographicDto } from "../dto/demographic.dto";
import { collectionCollector } from "./utils";

export const demographicsCollector = collectionCollector(
  "demographics",
  Demographic,
  "demographicalType",
  "demographicalId",
  { attributes: ["uuid", "collection", "demographicalType"], include: [{ association: "entries" }] },
  demographic => new EmbeddedDemographicDto(demographic)
);

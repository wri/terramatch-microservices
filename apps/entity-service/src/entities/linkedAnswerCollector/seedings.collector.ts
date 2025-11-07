import { Seeding } from "@terramatch-microservices/database/entities";
import { singlePropertyCollector } from "./utils";
import { EmbeddedSeedingDto } from "../dto/seeding.dto";

export const seedingsCollector = singlePropertyCollector(
  "seedings",
  Seeding,
  "seedableType",
  "seedableId",
  { attributes: ["uuid", "seedableType", "name", "amount", "weightOfSample", "seedsInSample"] },
  seeding => new EmbeddedSeedingDto(seeding)
);

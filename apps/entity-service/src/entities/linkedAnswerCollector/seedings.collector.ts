import { Seeding } from "@terramatch-microservices/database/entities";
import { singleAssociationCollection } from "./utils";
import { EmbeddedSeedingDto } from "../dto/seeding.dto";

export const seedingsCollector = singleAssociationCollection(
  "seedings",
  Seeding,
  "seedableType",
  "seedableId",
  { attributes: ["uuid", "seedableType", "name", "amount", "weightOfSample", "seedsInSample"] },
  seeding => new EmbeddedSeedingDto(seeding)
);

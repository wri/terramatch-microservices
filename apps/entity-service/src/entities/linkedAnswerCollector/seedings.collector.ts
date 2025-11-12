import { Seeding } from "@terramatch-microservices/database/entities";
import { RelationSync, singleAssociationCollection } from "./utils";
import { EmbeddedSeedingDto } from "../dto/seeding.dto";

const syncSeedings: RelationSync = async () => {
  // TODO TM-2624
};

export const seedingsCollector = singleAssociationCollection(Seeding, EmbeddedSeedingDto, syncSeedings);

import { Seeding } from "@terramatch-microservices/database/entities";
import { polymorphicCollector, RelationSync } from "./utils";
import { EmbeddedSeedingDto } from "../dto/seeding.dto";

const syncSeedings: RelationSync = async () => {
  // TODO TM-2624
};

export const seedingsCollector = polymorphicCollector(Seeding, EmbeddedSeedingDto, syncSeedings);

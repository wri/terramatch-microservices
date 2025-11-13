import { Invasive } from "@terramatch-microservices/database/entities";
import { polymorphicCollector, RelationSync } from "./utils";
import { EmbeddedInvasiveDto } from "../dto/invasive.dto";

const syncInvasives: RelationSync = async () => {
  // TODO TM-2624
};

export const invasivesCollector = polymorphicCollector(Invasive, EmbeddedInvasiveDto, syncInvasives);

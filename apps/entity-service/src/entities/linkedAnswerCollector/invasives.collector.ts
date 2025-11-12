import { Invasive } from "@terramatch-microservices/database/entities";
import { RelationSync, singleAssociationCollection } from "./utils";
import { EmbeddedInvasiveDto } from "../dto/invasive.dto";

const syncInvasives: RelationSync = async () => {
  // TODO TM-2624
};

export const invasivesCollector = singleAssociationCollection(Invasive, EmbeddedInvasiveDto, syncInvasives);

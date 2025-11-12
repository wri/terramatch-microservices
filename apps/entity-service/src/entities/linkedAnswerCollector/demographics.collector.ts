import { Demographic } from "@terramatch-microservices/database/entities";
import { EmbeddedDemographicDto } from "../dto/demographic.dto";
import { collectionCollector, RelationSync } from "./utils";

const syncDemographics: RelationSync = async () => {
  // TODO TM-2624
};

export const demographicsCollector = collectionCollector(Demographic, EmbeddedDemographicDto, syncDemographics, {
  association: "entries"
});

import { Demographic } from "@terramatch-microservices/database/entities";
import { EmbeddedDemographicDto } from "../dto/demographic.dto";
import { polymorphicCollector, RelationSync } from "./utils";

const syncDemographics: RelationSync = async () => {
  // TODO TM-2624
};

export const demographicsCollector = polymorphicCollector(Demographic, EmbeddedDemographicDto, syncDemographics, {
  association: "entries"
});

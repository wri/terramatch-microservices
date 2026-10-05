import { Stakeholder } from "@terramatch-microservices/database/entities";
import { attributeExporter, polymorphicCollector } from "./utils";
import { EmbeddedStakeholderDto } from "../../dto/stakeholder.dto";

export const stakeholdersCollector = polymorphicCollector(Stakeholder, EmbeddedStakeholderDto, {
  exportSerializer: attributeExporter(["name", "keyRole", "description"])
});

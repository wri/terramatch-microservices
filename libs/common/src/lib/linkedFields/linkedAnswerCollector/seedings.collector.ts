import { Seeding } from "@terramatch-microservices/database/entities";
import { attributeExporter, polymorphicCollector } from "./utils";
import { EmbeddedSeedingDto } from "../../dto/seeding.dto";

export const seedingsCollector = polymorphicCollector(Seeding, EmbeddedSeedingDto, {
  exportSerializer: attributeExporter(["name", "amount"])
});

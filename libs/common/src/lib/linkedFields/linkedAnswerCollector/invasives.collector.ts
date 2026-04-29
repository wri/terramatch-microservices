import { Invasive } from "@terramatch-microservices/database/entities";
import { attributeExporter, polymorphicCollector } from "./utils";
import { EmbeddedInvasiveDto } from "../../dto/invasive.dto";

export const invasivesCollector = polymorphicCollector(Invasive, EmbeddedInvasiveDto, {
  usesCollection: false,
  exportSerializer: attributeExporter(["type", "name"])
});

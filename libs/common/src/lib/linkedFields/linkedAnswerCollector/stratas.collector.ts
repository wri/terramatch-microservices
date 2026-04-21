import { Strata } from "@terramatch-microservices/database/entities";
import { attributeExporter, polymorphicCollector } from "./utils";
import { EmbeddedStrataDto } from "../../dto/strata.dto";

export const stratasCollector = polymorphicCollector(Strata, EmbeddedStrataDto, {
  exportSerializer: attributeExporter(["description", "extent"])
});

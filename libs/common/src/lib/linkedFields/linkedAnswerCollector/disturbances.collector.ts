import { Disturbance } from "@terramatch-microservices/database/entities";
import { attributeExporter, polymorphicCollector } from "./utils";
import { EmbeddedDisturbanceDto } from "../../dto/disturbance.dto";

export const disturbancesCollector = polymorphicCollector(Disturbance, EmbeddedDisturbanceDto, {
  usesCollection: false,
  exportSerializer: attributeExporter([
    "disturbanceStartDate",
    "disturbanceEndDate",
    "type",
    "subtype",
    "intensity",
    "extent",
    "peopleAffected",
    "monetaryDamage",
    "description",
    "actionDescription",
    "propertyAffected"
  ])
});

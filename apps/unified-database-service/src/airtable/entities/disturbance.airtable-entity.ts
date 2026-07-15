/* istanbul ignore file */
import { AirtableEntity } from "./airtable-entity";
import { Disturbance, DisturbanceReport, Site, SiteReport } from "@terramatch-microservices/database/entities";
import { associatedValueColumn, commonEntityColumns } from "../util/columns";
import { ColumnMapping, PolymorphicUuidAssociation } from "../util/types";

const LARAVEL_TYPE_MAPPING: Record<string, PolymorphicUuidAssociation<DisturbanceAssociations>> = {
  [Site.LARAVEL_TYPE]: {
    association: "siteUuid",
    model: Site
  },
  [SiteReport.LARAVEL_TYPE]: {
    association: "siteReportUuid",
    model: SiteReport
  },
  [DisturbanceReport.LARAVEL_TYPE]: {
    association: "disturbanceReportUuid",
    model: DisturbanceReport
  }
};

type DisturbanceAssociations = {
  siteUuid?: string;
  siteReportUuid?: string;
  disturbanceReportUuid?: string;
};

const COLUMNS: ColumnMapping<Disturbance, DisturbanceAssociations>[] = [
  ...commonEntityColumns<Disturbance, DisturbanceAssociations>(),
  "disturbanceDate",
  "type",
  "subtype",
  "intensity",
  "extent",
  "peopleAffected",
  "financialLoss",
  "description",
  "actionDescription",
  "propertyAffected",
  associatedValueColumn("siteUuid", ["disturbanceableId", "disturbanceableType"]),
  associatedValueColumn("siteReportUuid", ["disturbanceableId", "disturbanceableType"]),
  associatedValueColumn("disturbanceReportUuid", ["disturbanceableId", "disturbanceableType"])
];

export class DisturbanceEntity extends AirtableEntity<Disturbance, DisturbanceAssociations> {
  readonly TABLE_NAME = "Disturbances";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = Disturbance;
  readonly FILTER_FLAGS = ["hidden"];

  protected async loadAssociations(disturbances: Disturbance[]) {
    return this.loadPolymorphicUuidAssociations(
      LARAVEL_TYPE_MAPPING,
      "disturbanceableType",
      "disturbanceableId",
      disturbances
    );
  }
}
